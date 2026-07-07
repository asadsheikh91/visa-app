"""
outcome_service.py — Module 3: the outcome loop.

Pure logic for:
  - validating reported outcomes,
  - deciding when to *prompt* a user to report their result,
  - aggregating reported outcomes into approval-rate-by-readiness analytics
    (the proof + calibration signal).

No DB, no I/O — the router supplies already-loaded rows.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

VALID_OUTCOMES = ("approved", "refused", "withdrawn", "pending")
TERMINAL_OUTCOMES = ("approved", "refused", "withdrawn")  # "settled" — stops further prompting

# Days after a readiness check before we assume the user may have a decision and
# it's worth asking. Visa decisions take weeks, so we don't pester immediately.
DEFAULT_MIN_DAYS_SINCE_CHECK = 21

# Score buckets for analytics — aligned with the frontend's tierFromScore().
_BANDS = [
    (85, 100, "ready",        "Ready (85–100)"),
    (65, 84,  "mostly_ready", "Mostly ready (65–84)"),
    (40, 64,  "needs_work",   "Needs work (40–64)"),
    (0,  39,  "not_ready",    "Not ready (0–39)"),
]


def _coarsen_rate(approved: int, decisions: int) -> int:
    """Approval rate rounded to the nearest 10% — so one new record rarely moves it."""
    return int(round((100 * approved / decisions) / 10.0) * 10)


def _total_band(decisions: int) -> str:
    """Banded count range like '10-20' — hides the exact N from temporal differencing."""
    lo = (decisions // 10) * 10
    return f"{lo}-{lo + 10}"


def is_valid_outcome(outcome: str) -> bool:
    return (outcome or "").lower().strip() in VALID_OUTCOMES


def band_for_score(score: Optional[int]) -> Optional[dict]:
    """Map a 0–100 score to its analytics band, or None if score is missing/out of range."""
    if score is None:
        return None
    try:
        s = int(score)
    except (TypeError, ValueError):
        return None
    for lo, hi, key, label in _BANDS:
        if lo <= s <= hi:
            return {"key": key, "label": label, "min": lo, "max": hi}
    return None


def _parse_iso(d) -> Optional[date]:
    if isinstance(d, date):
        return d
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, str) and d.strip():
        try:
            return datetime.strptime(d.strip()[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


def should_prompt(
    latest_check_date: Optional[date],
    has_terminal_outcome_for_latest: bool,
    intake_date: Optional[date] = None,
    today: Optional[date] = None,
    min_days_since_check: int = DEFAULT_MIN_DAYS_SINCE_CHECK,
) -> bool:
    """
    Decide whether to ask the user to report their visa decision.

    Prompt when there is a readiness check, no settled outcome yet for it, and
    enough time has passed that a decision is plausible — either the course intake
    is here/past, or the check is at least `min_days_since_check` days old.
    """
    today = today or date.today()
    check_d = _parse_iso(latest_check_date)
    if check_d is None:
        return False
    if has_terminal_outcome_for_latest:
        return False
    intake = _parse_iso(intake_date)
    if intake is not None and intake <= today:
        return True
    return (today - check_d).days >= min_days_since_check


def approval_analytics(rows: list[dict], min_sample: int = 5) -> dict:
    """
    Aggregate reported outcomes into approval rates by readiness band.

    rows: [{score: int|None, outcome: str}, ...] — typically all users' terminal
    outcomes. Only approved/refused count toward the rate (withdrawn/pending are
    excluded from the denominator).

    Privacy / k-anonymity: a band with fewer than `min_sample` decisions is NOT
    disclosed at all — neither the approved/refused split nor a rate — because
    with a tiny N an attacker could infer an individual's outcome (e.g. a band
    with a single decision trivially reveals that person's result). Such bands
    are returned as {insufficient_data: True, approved: None, refused: None,
    approval_rate: None, total: <n>}; only the bare count of decisions remains
    (band membership alone leaks no outcome). The same threshold applies to the
    overall figure.

    Privacy / temporal differencing: even ABOVE the threshold we do NOT return
    raw approved/refused integers or the exact N. Comparing two snapshots over
    time, a single new record would change an exact count by 1 and reveal that
    individual's outcome. So disclosed bands expose only a coarsened
    `approval_rate` (rounded to the nearest 10%) and a banded `total_range`
    (e.g. "10-20"); a single-record change rarely moves either, and exact deltas
    are never observable.

    Returns:
      disclosed band  -> {key,label,total_range:"lo-hi",approval_rate,insufficient_data:False}
      suppressed band -> {key,label,total:int,approved:None,refused:None,
                          approval_rate:None,insufficient_data:True}
      overall mirrors the same two shapes.
    """
    buckets: dict[str, dict] = {
        key: {"key": key, "label": label, "approved": 0, "refused": 0}
        for _, _, key, label in _BANDS
    }
    overall = {"approved": 0, "refused": 0}

    for r in rows:
        outcome = (r.get("outcome") or "").lower().strip()
        if outcome not in ("approved", "refused"):
            continue
        band = band_for_score(r.get("score"))
        if band is None:
            continue
        buckets[band["key"]][outcome] += 1
        overall[outcome] += 1

    def suppress(key: str, label: str, decisions: int) -> dict:
        """Below-threshold: reveal only the bare decision count, no outcome split."""
        return {
            "key": key, "label": label, "total": decisions,
            "approved": None, "refused": None, "approval_rate": None,
            "insufficient_data": True,
        }

    def disclose(key: str, label: str, approved: int, decisions: int) -> dict:
        """Above-threshold: coarsened rate + banded total only (no raw counts/exact N)."""
        return {
            "key": key, "label": label,
            "total_range": _total_band(decisions),
            "approval_rate": _coarsen_rate(approved, decisions),
            "insufficient_data": False,
        }

    def finalize(b: dict) -> dict:
        decisions = b["approved"] + b["refused"]
        if decisions < min_sample:
            return suppress(b["key"], b["label"], decisions)
        return disclose(b["key"], b["label"], b["approved"], decisions)

    band_order = [key for _, _, key, _ in _BANDS]
    bands = [finalize(buckets[k]) for k in band_order]

    decisions = overall["approved"] + overall["refused"]
    if decisions < min_sample:
        overall_out = {
            "approved": None, "refused": None, "total": decisions,
            "approval_rate": None, "insufficient_data": True,
        }
    else:
        overall_out = {
            "total_range": _total_band(decisions),
            "approval_rate": _coarsen_rate(overall["approved"], decisions),
            "insufficient_data": False,
        }
    return {"bands": bands, "overall": overall_out}
