"""
remediate_band_mismatch.py

ONE-TIME remediation for the band-cap score/label divergence.

The bug (fixed in services/readiness_engine.py): when high-risk flags fired,
evaluate() capped the band LABEL (e.g. to "High Refusal Risk") but left the
numeric score uncapped, so rows like score=87 / result="High Refusal Risk"
were persisted. Reports built from those rows rendered a meter marker at 87
(inside the top zone of their own legend) next to a badge and a verdict
paragraph that said high risk — the report contradicted itself.

The stored LABEL was the deliberate, correct verdict (the cap is a designed
feature: flagged files must not present as ready). The SCORE failing to
reflect the cap was the bug. Remediation therefore caps the stored score down
to the max of the band named by the stored label — exactly what the fixed
engine now persists for the same answers.

Two phases:
  1. visa_checks — rows whose result label != band_for_score(score) get
     score capped to their result band's max.
  2. reports — encrypted payloads whose "band" != band_for_score(overallScore)
     get overallScore/bandPositionPct capped to the band's max (using the
     payload's own bands snapshot), then re-encrypted in place. verdictLead
     already matches the band and is left untouched.

Run from the backend/ directory:
    python -m scripts.remediate_band_mismatch             # DRY RUN (default)
    python -m scripts.remediate_band_mismatch --execute   # actually write

Safety properties
-----------------
* DRY RUN by default; without --execute nothing is written.
* Idempotent: consistent rows are skipped, so re-running is safe.
* A row whose stored label cannot be matched to a current band (e.g. the
  country's labels were renamed after the row was written), or whose score is
  BELOW its label's band (a shape the cap bug cannot produce), is skipped and
  reported for human review — never guessed at.
* All writes happen in one transaction per phase; any failure rolls back the
  whole phase.
* No PII is logged: only ids, countries, scores, and band labels.
"""

import argparse
import asyncio
import sys

from sqlalchemy import select

from database import async_session_maker
from models import Report, VisaCheck
from services.encryption import encrypt_json, is_available
from services.readiness_engine import band_for_score
from services.report_builder import decrypt_report_data
from services.visa_data_service import load_scoring


def _log(msg: str = "") -> None:
    print(msg, flush=True)


def _band_by_label(label: str, bands: list) -> dict | None:
    for b in bands:
        if b.get("label") == label:
            return b
    return None


async def _remediate_checks(session, execute: bool) -> tuple[int, int, int]:
    """Returns (consistent, capped, skipped)."""
    bands_cache: dict[str, list | None] = {}
    checks = (await session.execute(select(VisaCheck))).scalars().all()
    consistent = capped = skipped = 0

    for check in checks:
        country = (check.country or "").lower()
        if country not in bands_cache:
            try:
                bands_cache[country] = load_scoring("student_visa", country)["score_bands"]
            except Exception as exc:  # noqa: BLE001 — report and move on
                _log(f"  ! cannot load score_bands for {country!r}: {type(exc).__name__}")
                bands_cache[country] = None
        bands = bands_cache[country]
        if not bands:
            skipped += 1
            continue

        if band_for_score(check.score, bands)["label"] == check.result:
            consistent += 1
            continue

        target = _band_by_label(check.result, bands)
        if target is None:
            _log(f"  SKIP check={check.id} {country}: stored label {check.result!r} "
                 f"not found in current bands — review manually.")
            skipped += 1
            continue
        if check.score <= target["max"]:
            _log(f"  SKIP check={check.id} {country}: score {check.score} is below its "
                 f"label band {check.result!r} — not the cap-bug shape, review manually.")
            skipped += 1
            continue

        _log(f"  CAP  check={check.id} {country}: score {check.score} -> {target['max']} "
             f"(label {check.result!r}, {len(check.high_risk_flags or [])} high-risk flags)")
        if execute:
            check.score = target["max"]
        capped += 1

    if execute and capped:
        await session.commit()
    return consistent, capped, skipped


async def _remediate_reports(session, execute: bool) -> tuple[int, int, int]:
    """Returns (consistent, capped, skipped)."""
    reports = (await session.execute(select(Report))).scalars().all()
    consistent = capped = skipped = 0

    for report in reports:
        try:
            data = decrypt_report_data(report)
        except Exception as exc:  # noqa: BLE001
            _log(f"  SKIP report={report.report_id}: cannot decrypt ({type(exc).__name__}).")
            skipped += 1
            continue

        bands = data.get("bands") or []
        score = data.get("overallScore")
        label = data.get("band")
        if not bands or score is None or not label:
            _log(f"  SKIP report={report.report_id}: payload missing bands/score/band.")
            skipped += 1
            continue

        if band_for_score(score, bands)["label"] == label:
            consistent += 1
            continue

        target = _band_by_label(label, bands)
        if target is None or score <= target["max"]:
            _log(f"  SKIP report={report.report_id}: band {label!r} vs score {score} "
                 f"is not the cap-bug shape — review manually.")
            skipped += 1
            continue

        _log(f"  CAP  report={report.report_id}: overallScore {score} -> {target['max']} "
             f"(band {label!r}); marker moves into its band.")
        if execute:
            data["overallScore"] = float(target["max"])
            data["bandPositionPct"] = max(0.0, min(100.0, float(target["max"])))
            report.data_encrypted = encrypt_json(data)
        capped += 1

    if execute and capped:
        await session.commit()
    return consistent, capped, skipped


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true",
                        help="Write changes. Default is a dry run.")
    args = parser.parse_args()
    execute = args.execute

    if execute and not is_available():
        _log("FIELD_ENCRYPTION_KEY is not configured — cannot re-encrypt reports. Aborting.")
        return 1

    _log(f"Mode: {'EXECUTE' if execute else 'DRY RUN (no writes)'}")

    async with async_session_maker() as session:
        _log("\nPhase 1: visa_checks")
        c_ok, c_capped, c_skip = await _remediate_checks(session, execute)
        _log(f"  consistent={c_ok} capped={c_capped} skipped={c_skip}")

    async with async_session_maker() as session:
        _log("\nPhase 2: reports")
        r_ok, r_capped, r_skip = await _remediate_reports(session, execute)
        _log(f"  consistent={r_ok} capped={r_capped} skipped={r_skip}")

    if not execute and (c_capped or r_capped):
        _log("\nDry run only — re-run with --execute to apply the caps above.")
    if c_skip or r_skip:
        _log("\nSome rows were skipped and need manual review (see SKIP lines).")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
