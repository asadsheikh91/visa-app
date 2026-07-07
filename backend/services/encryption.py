"""
services/encryption.py

Application-level encryption for sensitive PII columns. Currently used for
UserDocument.extracted, which holds raw bank-statement figures the applicant
entered (account holder name, balances, bank name).

Why Fernet (cryptography) rather than pgcrypto:
  - The key lives only in the app environment (FIELD_ENCRYPTION_KEY) and never
    touches the database, so a DB / backup compromise yields only ciphertext.
    With pgcrypto the key has to be handed to the database on every query
    (function arg or session GUC), which widens its exposure to DB logs and
    anyone with DB access — the exact threat we're mitigating.
  - Fernet = AES-128-CBC + HMAC-SHA256: authenticated (tamper-evident) and a
    vetted standard — no hand-rolled crypto.
  - Pure application layer, so it works identically on Postgres (prod) and any
    other backend without a DB extension or schema migration.

The ciphertext is stored as a small JSON envelope so a value is self-describing
and we can tell encrypted rows from any legacy plaintext rows:
    {"enc": "fernet", "v": 1, "ciphertext": "<urlsafe-base64 token>"}

The key (FIELD_ENCRYPTION_KEY) is a urlsafe-base64 32-byte Fernet key. It is
read from the environment on use and is NEVER logged. Generate one with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

import json
import os

from cryptography.fernet import Fernet, InvalidToken

_ENV_VAR = "FIELD_ENCRYPTION_KEY"
_ENVELOPE_SCHEME = "fernet"


class EncryptionUnavailableError(RuntimeError):
    """Raised when FIELD_ENCRYPTION_KEY is missing or malformed."""


class DecryptionError(RuntimeError):
    """Raised when a stored ciphertext cannot be decrypted (wrong key / tampered)."""


def _fernet() -> Fernet:
    """
    Build a Fernet from FIELD_ENCRYPTION_KEY. Raises EncryptionUnavailableError
    if the key is missing or not a valid Fernet key. The key value itself is
    never included in the error message (only the env var name).
    """
    key = os.getenv(_ENV_VAR, "").strip()
    if not key:
        raise EncryptionUnavailableError(
            f"{_ENV_VAR} is not set. A 32-byte urlsafe-base64 Fernet key is "
            "required to store sensitive document data."
        )
    try:
        return Fernet(key.encode("utf-8"))
    except (ValueError, TypeError) as exc:
        # Do NOT echo the key — only that it was invalid.
        raise EncryptionUnavailableError(
            f"{_ENV_VAR} is not a valid Fernet key (expected urlsafe-base64 32 bytes)."
        ) from exc


def is_available() -> bool:
    """True when a usable encryption key is configured. Cheap, never raises."""
    try:
        _fernet()
        return True
    except EncryptionUnavailableError:
        return False


def encrypt_json(data) -> dict:
    """
    Encrypt a JSON-serialisable value and return the storable envelope dict.
    Raises EncryptionUnavailableError when no key is configured.
    """
    f = _fernet()
    plaintext = json.dumps(data, separators=(",", ":"), default=str).encode("utf-8")
    token = f.encrypt(plaintext).decode("utf-8")
    return {"enc": _ENVELOPE_SCHEME, "v": 1, "ciphertext": token}


def _is_envelope(stored) -> bool:
    return (
        isinstance(stored, dict)
        and stored.get("enc") == _ENVELOPE_SCHEME
        and isinstance(stored.get("ciphertext"), str)
    )


def is_envelope(stored) -> bool:
    """
    Public predicate: True iff `stored` is a well-formed encryption envelope
    (as produced by encrypt_json). Used by write paths as a defence-in-depth
    guard so a future refactor can never silently persist plaintext PII, and by
    tests asserting data is encrypted at rest.
    """
    return _is_envelope(stored)


def decrypt_json(stored):
    """
    Reverse encrypt_json(). Returns the original value.

    Backward compatibility: if `stored` is None or is not an encryption envelope
    (i.e. a legacy plaintext row written before encryption was enabled), it is
    returned unchanged. Only well-formed envelopes are decrypted.

    Raises:
      EncryptionUnavailableError — envelope present but no key configured.
      DecryptionError            — envelope present but token can't be decrypted.
    """
    if not _is_envelope(stored):
        return stored  # None or legacy plaintext — nothing to decrypt.
    f = _fernet()
    try:
        plaintext = f.decrypt(stored["ciphertext"].encode("utf-8"))
    except InvalidToken as exc:
        raise DecryptionError("Stored document data could not be decrypted.") from exc
    return json.loads(plaintext.decode("utf-8"))
