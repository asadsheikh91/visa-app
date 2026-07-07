"""
remediate_plaintext_documents.py

ONE-TIME remediation: encrypt legacy plaintext rows in UserDocument.extracted.

These rows predate field encryption (written by an earlier implementation of the
financial-document feature) and hold applicant PII -- bank name, balances, account
holder -- in the clear. This script finds every row whose `extracted` is NOT
already a Fernet envelope and re-encrypts it in place using the SAME encrypt_json
the live write path uses (services/encryption.py). It does not re-implement crypto.

Run from the backend/ directory:
    python -m scripts.remediate_plaintext_documents             # DRY RUN (default)
    python -m scripts.remediate_plaintext_documents --execute   # actually write

Safety properties
-----------------
* DRY RUN by default. Without --execute nothing is read-modified-written; the
  script only reports which rows WOULD change.
* Before ANY write, every affected row's raw plaintext is copied to a dedicated
  backup table (user_documents_plaintext_backup_YYYYMMDD), committed in its OWN
  transaction. The backup therefore survives even if the re-encryption fails
  partway, the process is killed, or the key turns out to be wrong -- we never
  rely on rollback alone. (The backup is plaintext BY DESIGN: it is the recovery
  copy. Drop it once the migration is verified.)
* Idempotent / re-runnable: rows already enveloped are skipped via is_envelope(),
  so an interrupted run can simply be re-run without double-encrypting.
* All re-encryption writes happen inside ONE transaction. If any single row
  fails to encrypt or write, the whole batch rolls back -- never half-applied.
* PII content is NEVER logged -- not in dry-run output, not in errors, not in
  verification. Only row ids, timestamps, status, field NAMES, and booleans.
* After writing, every affected row is read back in a fresh session and verified:
  is_envelope() is True and decrypt_json() returns a sensible dict without raising.
"""

import argparse
import asyncio
import sys
from datetime import datetime, timezone

from sqlalchemy import bindparam, select, text

from database import async_session_maker
from models import UserDocument
from services.encryption import (
    encrypt_json,
    decrypt_json,
    is_envelope,
    is_available,
)

# Dated, clearly-named, dedicated backup table. Same DB; plaintext recovery copy.
BACKUP_TABLE = f"user_documents_plaintext_backup_{datetime.now(timezone.utc):%Y%m%d}"

# Field NAMES (schema, not values) used only to sanity-check decrypted structure.
# Logging a key name like "bank_name" is fine; logging its value is NOT.
_EXPECTED_HINT_KEYS = {
    "bank_name", "bank_id", "account_holder", "account_number_masked",
    "currency", "period_start", "period_end", "opening_balance",
    "closing_balance", "transactions",
}


def _log(msg: str = "") -> None:
    print(msg, flush=True)


async def _find_plaintext_rows(session):
    """
    Return (plaintext, enveloped, empty):
      plaintext -> list of (id, created_at, status) whose extracted is NOT an envelope
      enveloped -> count already encrypted
      empty     -> count with NULL extracted
    The PII payload is inspected only to classify it; it is never returned/logged.
    """
    result = await session.execute(
        select(
            UserDocument.id,
            UserDocument.created_at,
            UserDocument.status,
            UserDocument.extracted,
        )
    )
    plaintext, enveloped, empty = [], 0, 0
    for row in result.all():
        ex = row.extracted
        if ex is None:
            empty += 1
        elif is_envelope(ex):
            enveloped += 1
        else:
            plaintext.append((row.id, row.created_at, row.status))
    # Stable order for deterministic, comparable output.
    plaintext.sort(key=lambda r: (r[1] or datetime.min))
    return plaintext, enveloped, empty


async def _backup_rows(session, ids) -> int:
    """
    Copy the raw plaintext of the affected rows into BACKUP_TABLE and COMMIT in
    its own transaction. The copy is done server-side (INSERT ... SELECT) so the
    plaintext never passes through this process. Idempotent: rows already present
    in the backup table are not re-copied. Returns the backup table's total count.
    """
    await session.execute(text(
        f"""
        CREATE TABLE IF NOT EXISTS {BACKUP_TABLE} (
            id           uuid PRIMARY KEY,
            doc_type     text,
            status       text,
            created_at   timestamp,
            extracted    json,
            backed_up_at timestamp NOT NULL DEFAULT (now() at time zone 'utc')
        )
        """
    ))
    insert_stmt = text(
        f"""
        INSERT INTO {BACKUP_TABLE} (id, doc_type, status, created_at, extracted)
        SELECT d.id, d.doc_type, d.status, d.created_at, d.extracted
        FROM user_documents d
        WHERE d.id IN :ids
          AND d.id NOT IN (SELECT id FROM {BACKUP_TABLE})
        """
    ).bindparams(bindparam("ids", expanding=True))
    await session.execute(insert_stmt, {"ids": ids})
    await session.commit()  # <-- backup is durable independently of re-encryption

    total = await session.execute(text(f"SELECT count(*) FROM {BACKUP_TABLE}"))
    return int(total.scalar_one())


async def _reencrypt_rows(session, ids) -> int:
    """
    Re-encrypt every affected row inside a SINGLE transaction. Any exception
    (encryption failure, missing row, write error) rolls back ALL of them.
    Skips rows already enveloped so the script is safely re-runnable.
    Returns the number of rows actually changed.
    """
    changed = 0
    # One transaction for the whole batch: nothing is committed until every row
    # has been encrypted, so any failure rolls back ALL of them (never half-applied).
    try:
        for _id in ids:
            doc = await session.get(UserDocument, _id)
            if doc is None:
                raise RuntimeError(f"row {_id} disappeared mid-migration; aborting (rollback)")
            if is_envelope(doc.extracted):
                continue  # already done by a prior run
            # Same function the live /evaluate write path uses. Raises (and thus
            # rolls back the whole batch) if the key is missing/invalid.
            doc.extracted = encrypt_json(doc.extracted)
            changed += 1
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    return changed


async def _verify(ids) -> bool:
    """
    Fresh-session read-back of every affected row. Confirms is_envelope() is True
    and decrypt_json() returns a sensible dict (no raise, recognisable fields).
    Logs only ids and booleans -- never decrypted values.
    """
    all_ok = True
    async with async_session_maker() as vsession:
        for _id in ids:
            doc = await vsession.get(UserDocument, _id)
            ok_env = doc is not None and is_envelope(doc.extracted)
            ok_dec = False
            if ok_env:
                try:
                    dec = decrypt_json(doc.extracted)
                    ok_dec = isinstance(dec, dict) and bool(set(dec.keys()) & _EXPECTED_HINT_KEYS)
                except Exception as exc:  # never include the payload in the message
                    _log(f"  [FAIL] id={_id}  decrypt raised {type(exc).__name__}")
            row_ok = ok_env and ok_dec
            all_ok = all_ok and row_ok
            _log(f"  [{'PASS' if row_ok else 'FAIL'}] id={_id}  is_envelope={ok_env}  decrypt_ok={ok_dec}")
    return all_ok


async def run(execute: bool) -> int:
    if not is_available():
        _log("ABORT: FIELD_ENCRYPTION_KEY is not configured or invalid. Refusing to run.")
        return 2

    async with async_session_maker() as session:
        plaintext, enveloped, empty = await _find_plaintext_rows(session)

        _log("=" * 70)
        _log(f"MODE: {'EXECUTE (writes enabled)' if execute else 'DRY RUN (no writes)'}")
        _log(f"Scan of user_documents: {len(plaintext)} plaintext, "
             f"{enveloped} already-encrypted, {empty} null/empty.")
        _log("=" * 70)

        if not plaintext:
            _log("Nothing to remediate -- every row is already an envelope (or empty).")
            return 0

        _log("Rows that WOULD be re-encrypted (PII intentionally not shown):")
        for _id, created, status in plaintext:
            created_s = created.isoformat() if created else "?"
            _log(f"  - id={_id}  created={created_s}  status={status}  state=PLAINTEXT")
        ids = [p[0] for p in plaintext]

        if not execute:
            _log("")
            _log(f"DRY RUN complete. {len(ids)} row(s) would be backed up to "
                 f"{BACKUP_TABLE} and re-encrypted.")
            _log("Re-run with --execute to apply (writes a committed backup first).")
            return 0

        # ---- EXECUTE ----------------------------------------------------------
        _log("")
        _log(f"[1/4] Backing up {len(ids)} raw row(s) to {BACKUP_TABLE} "
             f"(committed in its own transaction)...")
        backup_total = await _backup_rows(session, ids)
        _log(f"      OK. Backup table now holds {backup_total} row(s).")

        _log(f"[2/4] Re-encrypting {len(ids)} row(s) in a single transaction...")
        try:
            changed = await _reencrypt_rows(session, ids)
        except Exception as exc:
            _log(f"      FAILED: {type(exc).__name__}: {exc}")
            _log(f"      Transaction rolled back -- no rows modified. "
                 f"Backup retained at {BACKUP_TABLE}.")
            return 1
        _log(f"      OK. {changed} row(s) encrypted; transaction committed.")

        _log(f"[3/4] Verifying read-back for {len(ids)} row(s) (fresh session)...")
        ok = await _verify(ids)

        _log(f"[4/4] {'ALL ROWS VERIFIED.' if ok else 'VERIFICATION FAILED -- investigate.'}")
        _log("")
        _log(f"NOTE: {BACKUP_TABLE} still contains PLAINTEXT PII. Once you have "
             f"confirmed the migration, drop it:")
        _log(f"      DROP TABLE {BACKUP_TABLE};")
        return 0 if ok else 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually perform the backup + re-encryption. Without this flag the "
             "script is a dry run and writes nothing.",
    )
    args = parser.parse_args()
    sys.exit(asyncio.run(run(args.execute)))


if __name__ == "__main__":
    main()
