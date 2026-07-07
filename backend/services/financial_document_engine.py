"""
financial_document_engine.py

The rule engine for the Document Financial Checker. Given a *parsed + confirmed*
bank statement and the applicant's context, it evaluates the statement against
the UK Student route financial rules and returns the same rule_checks shape used
by financial_proof_engine — so the frontend renders both identically.

This is the ONLY place a decision is made, and every decision is made by these
deterministic rules. No AI, no I/O, no DB.

What reading the real statement unlocks (vs a questionnaire):
  - the LOWEST balance maintained across the binding 28-consecutive-day window,
    which is the legally operative figure for the UK maintenance requirement;
  - whether the statement actually *covers* 28 days ending near the application;
  - large credits landing inside that window (which can reset the clock).

UK rule reference (UKVI Student route, finances):
  - The required funds must be held for a 28-day consecutive period, and the
    balance must not fall below the required amount on any day in that period.
  - The end of that 28-day period must be within 31 days of the application date.
  - Required amount = remaining first-year tuition + maintenance
    (£1,483/mo London or £1,136/mo outside, capped at 9 months).
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from services.financial_proof_engine import (
    _maintenance,
    _FINANCIAL_SOURCES,
    _CURRENCY_CODES,
    _CURRENCY_SYMBOLS,
)

SEASONING_DAYS = 28          # consecutive days the balance must be maintained
RECENCY_DAYS = 31            # window/statement must end within this many days of applying

# A credit landing inside the 28-day window at or above this fraction of the
# required amount is flagged for a source-of-funds explanation.
_LARGE_DEPOSIT_FRACTION = 0.10

_TITLES = {"mr", "mrs", "ms", "miss", "dr", "mr.", "mrs.", "ms.", "dr.", "m/s", "mst"}


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def _rc(rule_id: str, label: str, status: str, detail: str,
        threshold: str, source: Optional[dict]) -> dict:
    """One rule-by-rule result — identical shape to financial_proof_engine._rc."""
    return {"rule_id": rule_id, "label": label, "status": status,
            "detail": detail, "threshold": threshold, "source": source}


def _as_date(v) -> Optional[date]:
    if isinstance(v, date):
        return v
    if isinstance(v, str) and v.strip():
        try:
            return date.fromisoformat(v.strip()[:10])
        except ValueError:
            return None
    return None


def _name_tokens(name: Optional[str]) -> set[str]:
    if not name:
        return set()
    toks = [t for t in "".join(c.lower() if (c.isalnum() or c.isspace()) else " "
                              for c in name).split() if t]
    return {t for t in toks if t not in _TITLES}


def _names_match(holder: Optional[str], candidates: list[str]) -> bool:
    """True if the holder's name reasonably matches any candidate (token overlap)."""
    h = _name_tokens(holder)
    if not h:
        return False
    for cand in candidates:
        c = _name_tokens(cand)
        if not c:
            continue
        # Match when the shorter name's tokens are (almost) all in the other.
        shorter, longer = (h, c) if len(h) <= len(c) else (c, h)
        overlap = len(shorter & longer)
        if overlap and overlap >= len(shorter) - (1 if len(shorter) > 2 else 0):
            return True
    return False


def _points(transactions: list[dict]) -> list[tuple[date, float]]:
    """Sorted (date, running-balance) points from confirmed transactions."""
    pts: list[tuple[date, float]] = []
    for t in transactions or []:
        d = _as_date(t.get("date"))
        b = t.get("balance")
        if d is not None and isinstance(b, (int, float)):
            pts.append((d, float(b)))
    pts.sort(key=lambda p: p[0])
    return pts


def min_balance_in_window(points: list[tuple[date, float]],
                          opening_balance: Optional[float],
                          window_start: date,
                          window_end: date) -> Optional[float]:
    """
    Lowest balance the account held at any moment in [window_start, window_end].

    The balance on a given day is the running balance of the last transaction on
    or before that day. So the minimum over the window is the minimum of:
      - the balance carried INTO window_start (last point before it, else opening),
      - every point's balance that falls within the window.

    Returns None when the balance entering the window is unknown AND there is no
    in-window data point at window_start — i.e. we cannot verify it, so the caller
    must not pass it.
    """
    carried: Optional[float] = opening_balance
    in_window: list[float] = []
    for d, b in points:
        if d < window_start:
            carried = b            # most recent balance before the window
        elif d <= window_end:
            in_window.append(b)

    candidates = [b for b in ([carried] + in_window) if b is not None]
    if not candidates:
        return None
    # If nothing carried in and the first in-window point is after window_start,
    # we don't know the balance at the start of the window → cannot verify.
    if carried is None:
        first_in = min((d for d, _ in points if window_start <= d <= window_end),
                       default=None)
        if first_in is None or first_in > window_start:
            return None
    return min(candidates)


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

def evaluate(statement: dict, context: dict, country: str = "uk") -> dict:
    """
    Evaluate a confirmed parsed statement against the destination's financial rules.

    statement (confirmed values; ParsedStatement.to_dict shape):
      account_holder, currency, period_start, period_end,
      opening_balance, closing_balance, transactions[{date, amount, balance}]

    context:
      applicant_name        str
      application_date      ISO str  (default: latest statement date)
      required_amount       float    (if omitted, computed from the fields below)
      tuition_fee           float
      deposit_paid          float
      course_location       "london" | "outside"
      course_months         int
      sponsor_names         list[str]   (when third-party funded)
      fx_rate_to_gbp        float        (required when currency != destination currency)

    Returns:
      { overall_status, required_amount, currency, currency_symbol,
        window: {start, end, min_balance}, rule_checks: [...], summary: str }
    """
    country = (country or "uk").lower().strip()
    src = _FINANCIAL_SOURCES.get(country, _FINANCIAL_SOURCES["uk"])
    dest_currency = _CURRENCY_CODES.get(country, "GBP")
    symbol = _CURRENCY_SYMBOLS.get(country, "£")

    period_start = _as_date(statement.get("period_start"))
    period_end = _as_date(statement.get("period_end"))
    closing = statement.get("closing_balance")
    opening = statement.get("opening_balance")
    holder = statement.get("account_holder")
    stmt_currency = (statement.get("currency") or "").upper() or None
    points = _points(statement.get("transactions"))

    # ── Required amount ──────────────────────────────────────────────────────
    required = context.get("required_amount")
    if required is None:
        tuition = float(context.get("tuition_fee") or 0)
        deposit = float(context.get("deposit_paid") or 0)
        remaining_tuition = max(0.0, tuition - deposit)
        living = _maintenance(country, (context.get("course_location") or "").lower(),
                              float(context.get("course_months") or 0))
        required = remaining_tuition + living
    required = float(required)

    application_date = _as_date(context.get("application_date")) or period_end

    rule_checks: list[dict] = []

    # ── Currency conversion (only when statement isn't in destination currency) ─
    fx_rate = context.get("fx_rate_to_gbp")
    conversion_ok = True
    if stmt_currency and stmt_currency != dest_currency:
        if fx_rate:
            rule_checks.append(_rc(
                "currency_conversion", "Currency converted to destination currency", "warn",
                f"Statement is in {stmt_currency}; converted at {fx_rate} {dest_currency}/{stmt_currency}. "
                f"Confirm the rate against the official source used by the caseworker on your application date.",
                f"1 {stmt_currency} = {fx_rate} {dest_currency}", src,
            ))
            fx = float(fx_rate)

            def conv(v):
                return None if v is None else v * fx
            opening = conv(opening)
            closing = conv(closing)
            points = [(d, b * fx) for d, b in points]
        else:
            conversion_ok = False
            rule_checks.append(_rc(
                "currency_conversion", "Currency conversion required", "fail",
                f"Statement is in {stmt_currency}, but the requirement is in {dest_currency}. "
                f"Provide the conversion rate so funds can be compared to the threshold.",
                f"Convert {stmt_currency} → {dest_currency}", src,
            ))

    # ── 28-day seasoning coverage + minimum balance (the core test) ───────────
    if period_end is None:
        rule_checks.append(_rc(
            "seasoning_coverage", f"Statement covers {SEASONING_DAYS} consecutive days", "warn",
            "The statement date range could not be confirmed — confirm the period dates.",
            f"{SEASONING_DAYS} consecutive days", src,
        ))
        window_start = window_end = None
        min_bal = None
    else:
        window_end = period_end
        window_start = window_end - timedelta(days=SEASONING_DAYS - 1)
        covered = period_start is not None and period_start <= window_start
        if covered:
            rule_checks.append(_rc(
                "seasoning_coverage", f"Statement covers {SEASONING_DAYS} consecutive days", "pass",
                f"Statement runs {period_start.isoformat()} → {period_end.isoformat()}, covering the "
                f"{SEASONING_DAYS}-day window ending {window_end.isoformat()}.",
                f"{SEASONING_DAYS} consecutive days", src,
            ))
        else:
            rule_checks.append(_rc(
                "seasoning_coverage", f"Statement covers {SEASONING_DAYS} consecutive days", "fail",
                f"The statement does not cover a full {SEASONING_DAYS}-day period before {window_end.isoformat()}. "
                f"Provide a statement spanning at least {SEASONING_DAYS} consecutive days.",
                f"{SEASONING_DAYS} consecutive days", src,
            ))
        min_bal = min_balance_in_window(points, opening, window_start, window_end) if covered else None

    # ── Funds meet the threshold across the whole window ──────────────────────
    if not conversion_ok:
        rule_checks.append(_rc(
            "maintenance_28day_minimum", f"Lowest balance over {SEASONING_DAYS} days meets the requirement",
            "warn",
            "Cannot compare funds to the requirement until a currency conversion rate is provided.",
            f"{symbol}{required:,.0f} held for {SEASONING_DAYS} days", src,
        ))
    elif min_bal is None:
        rule_checks.append(_rc(
            "maintenance_28day_minimum", f"Lowest balance over {SEASONING_DAYS} days meets the requirement",
            "warn",
            f"Could not verify the balance across the full {SEASONING_DAYS}-day window from this statement. "
            "Confirm the transactions/balances or provide a complete statement.",
            f"{symbol}{required:,.0f} held for {SEASONING_DAYS} days", src,
        ))
    else:
        status = "pass" if min_bal >= required else "fail"
        if status == "pass":
            detail = (f"Lowest balance in the {SEASONING_DAYS}-day window "
                      f"({window_start.isoformat()} → {window_end.isoformat()}) was "
                      f"{symbol}{min_bal:,.0f}, at or above the required {symbol}{required:,.0f}.")
        else:
            detail = (f"Lowest balance in the {SEASONING_DAYS}-day window dropped to "
                      f"{symbol}{min_bal:,.0f}, below the required {symbol}{required:,.0f} "
                      f"(short by {symbol}{required - min_bal:,.0f}). The balance must stay at or "
                      f"above the requirement on every day of the period.")
        rule_checks.append(_rc(
            "maintenance_28day_minimum", f"Lowest balance over {SEASONING_DAYS} days meets the requirement",
            status, detail, f"{symbol}{required:,.0f} held for {SEASONING_DAYS} days", src,
        ))

    # ── Statement / window recency ────────────────────────────────────────────
    if period_end and application_date:
        gap = (application_date - period_end).days
        if 0 <= gap <= RECENCY_DAYS:
            rec_status, rec_detail = "pass", (
                f"Statement ends {period_end.isoformat()}, {gap} day(s) before the application date — "
                f"within the {RECENCY_DAYS}-day limit.")
        elif gap < 0:
            rec_status, rec_detail = "warn", (
                f"Statement end date ({period_end.isoformat()}) is after the application date. "
                "Confirm the application date.")
        else:
            rec_status, rec_detail = "fail", (
                f"Statement ends {period_end.isoformat()}, {gap} days before the application date — "
                f"older than the {RECENCY_DAYS}-day limit. Obtain a more recent statement.")
        rule_checks.append(_rc(
            "statement_recency", "Statement dated within the recency limit",
            rec_status, rec_detail, f"Within {RECENCY_DAYS} days of applying", src,
        ))

    # ── Account holder match ──────────────────────────────────────────────────
    applicant = context.get("applicant_name") or ""
    sponsors = [s for s in (context.get("sponsor_names") or []) if s]
    candidates = [applicant] + sponsors
    if holder and any(_name_tokens(c) for c in candidates):
        if _names_match(holder, candidates):
            ah_status, ah_detail = "pass", f"Account holder ('{holder}') matches the applicant/sponsor on record."
        elif sponsors and _names_match(holder, sponsors):
            ah_status, ah_detail = "pass", f"Account is held by the named sponsor ('{holder}')."
        else:
            ah_status, ah_detail = "fail", (
                f"Account holder ('{holder}') does not match the applicant or a declared sponsor. "
                "Funds in a third party's account are only accepted from a parent/legal guardian or "
                "partner, with consent and proof of relationship.")
        rule_checks.append(_rc(
            "account_holder_match", "Account holder is the applicant or an accepted sponsor",
            ah_status, ah_detail, "Applicant / parent / guardian / partner", src,
        ))
    elif holder:
        rule_checks.append(_rc(
            "account_holder_match", "Account holder is the applicant or an accepted sponsor", "warn",
            f"Account holder read as '{holder}', but no applicant/sponsor name was provided to compare against.",
            "Applicant / parent / guardian / partner", src,
        ))

    # ── Large deposits inside the window ──────────────────────────────────────
    large_threshold = max(required * _LARGE_DEPOSIT_FRACTION, 1.0)
    big = []
    if window_start and window_end:
        fx = float(fx_rate) if (fx_rate and stmt_currency and stmt_currency != dest_currency) else 1.0
        for t in statement.get("transactions") or []:
            d = _as_date(t.get("date"))
            amt = t.get("amount")
            if d and window_start <= d <= window_end and isinstance(amt, (int, float)) and amt * fx >= large_threshold:
                big.append((d, amt * fx))
    if big:
        listed = ", ".join(f"{symbol}{a:,.0f} on {d.isoformat()}" for d, a in big[:5])
        rule_checks.append(_rc(
            "large_deposits", "Large deposits inside the holding period are explained", "warn",
            f"Large credit(s) landed inside the {SEASONING_DAYS}-day window ({listed}). A late large deposit can "
            "reset the holding clock — prepare a source-of-funds explanation and evidence for each.",
            f"Credits ≥ {symbol}{large_threshold:,.0f} documented", src,
        ))
    elif window_start:
        rule_checks.append(_rc(
            "large_deposits", "Large deposits inside the holding period are explained", "pass",
            f"No unusually large credits detected inside the {SEASONING_DAYS}-day window.",
            f"Credits ≥ {symbol}{large_threshold:,.0f} documented", src,
        ))

    # ── Overall ───────────────────────────────────────────────────────────────
    statuses = [rc["status"] for rc in rule_checks]
    if "fail" in statuses:
        overall = "fail"
    elif "warn" in statuses:
        overall = "warn"
    else:
        overall = "pass"

    summary = {
        "pass": "This statement meets the financial rules we checked.",
        "warn": "This statement may meet the rules, but some items need confirmation or more evidence.",
        "fail": "This statement does not currently satisfy the financial rules — see the failed checks.",
    }[overall]

    return {
        "overall_status": overall,
        "required_amount": round(required, 2),
        "currency": dest_currency,
        "currency_symbol": symbol,
        "window": {
            "start": window_start.isoformat() if window_start else None,
            "end": window_end.isoformat() if window_end else None,
            "min_balance": round(min_bal, 2) if isinstance(min_bal, (int, float)) else None,
        },
        "rule_checks": rule_checks,
        "summary": summary,
    }
