"""
tests/test_financial_document_engine.py

The rule engine: given a confirmed statement + context, evaluate against the UK
financial rules. Pure function. The rolling 28-day minimum-balance logic is the
core of the module, so it gets the most coverage.
"""

from datetime import date, timedelta

from services.financial_document_engine import (
    evaluate, min_balance_in_window, _names_match,
)


def _rule(result, rule_id):
    for rc in result["rule_checks"]:
        if rc["rule_id"] == rule_id:
            return rc
    raise AssertionError(f"rule {rule_id!r} not found in {[r['rule_id'] for r in result['rule_checks']]}")


def _stmt(transactions, *, start, end, opening=None, closing=None,
          holder="Ahmed Raza Khan", currency="GBP"):
    return {
        "account_holder": holder,
        "currency": currency,
        "period_start": start,
        "period_end": end,
        "opening_balance": opening,
        "closing_balance": closing,
        "transactions": transactions,
    }


# ── min_balance_in_window ────────────────────────────────────────────────────

def test_min_balance_uses_carried_in_balance():
    # Balance enters the window at 20,000 (carried), never changes inside.
    pts = [(date(2026, 5, 1), 20000.0)]
    m = min_balance_in_window(pts, opening_balance=20000.0,
                              window_start=date(2026, 6, 1), window_end=date(2026, 6, 28))
    assert m == 20000.0


def test_min_balance_catches_dip_inside_window():
    pts = [
        (date(2026, 6, 1), 20000.0),
        (date(2026, 6, 10), 5000.0),   # dip below
        (date(2026, 6, 20), 21000.0),
    ]
    m = min_balance_in_window(pts, 20000.0, date(2026, 6, 1), date(2026, 6, 28))
    assert m == 5000.0


def test_min_balance_unknown_when_no_coverage():
    # No opening and first point is after window_start → cannot verify.
    pts = [(date(2026, 6, 15), 20000.0)]
    m = min_balance_in_window(pts, opening_balance=None,
                              window_start=date(2026, 6, 1), window_end=date(2026, 6, 28))
    assert m is None


# ── Name matching ────────────────────────────────────────────────────────────

def test_names_match_with_title_and_partial():
    assert _names_match("Mr. Ahmed Raza Khan", ["Ahmed Khan"])
    assert _names_match("AHMED RAZA KHAN", ["Ahmed Raza Khan"])
    assert not _names_match("Someone Else Entirely", ["Ahmed Raza Khan"])


# ── End-to-end engine behaviour ──────────────────────────────────────────────

def _passing_uk_context():
    return {
        "applicant_name": "Ahmed Raza Khan",
        "application_date": "2026-07-05",
        "required_amount": 20000.0,
    }


def test_seasoning_passes_when_balance_held_above_required():
    txns = [
        {"date": "2026-06-01", "amount": 0, "balance": 25000.0},
        {"date": "2026-06-15", "amount": 1000.0, "balance": 26000.0},
        {"date": "2026-06-28", "amount": 0, "balance": 26000.0},
    ]
    s = _stmt(txns, start="2026-06-01", end="2026-06-28", opening=25000.0, closing=26000.0)
    result = evaluate(s, _passing_uk_context(), "uk")
    assert _rule(result, "maintenance_28day_minimum")["status"] == "pass"
    assert _rule(result, "seasoning_coverage")["status"] == "pass"
    assert result["window"]["min_balance"] == 25000.0
    assert result["overall_status"] in ("pass", "warn")  # warn only if some sub-check warns


def test_seasoning_fails_when_balance_dips_below_required():
    txns = [
        {"date": "2026-06-01", "amount": 0, "balance": 25000.0},
        {"date": "2026-06-10", "amount": -10000.0, "balance": 15000.0},  # dips below 20k
        {"date": "2026-06-28", "amount": 11000.0, "balance": 26000.0},
    ]
    s = _stmt(txns, start="2026-06-01", end="2026-06-28", opening=25000.0, closing=26000.0)
    result = evaluate(s, _passing_uk_context(), "uk")
    assert _rule(result, "maintenance_28day_minimum")["status"] == "fail"
    assert result["overall_status"] == "fail"


def test_coverage_fails_when_period_too_short():
    txns = [
        {"date": "2026-06-15", "amount": 0, "balance": 25000.0},
        {"date": "2026-06-28", "amount": 0, "balance": 25000.0},
    ]
    s = _stmt(txns, start="2026-06-15", end="2026-06-28", opening=25000.0, closing=25000.0)
    result = evaluate(s, _passing_uk_context(), "uk")
    assert _rule(result, "seasoning_coverage")["status"] == "fail"


def test_recency_fails_when_statement_too_old():
    ctx = _passing_uk_context()
    ctx["application_date"] = "2026-09-01"   # > 31 days after period_end
    txns = [
        {"date": "2026-06-01", "amount": 0, "balance": 25000.0},
        {"date": "2026-06-28", "amount": 0, "balance": 25000.0},
    ]
    s = _stmt(txns, start="2026-06-01", end="2026-06-28", opening=25000.0, closing=25000.0)
    result = evaluate(s, ctx, "uk")
    assert _rule(result, "statement_recency")["status"] == "fail"


def test_holder_mismatch_fails():
    s = _stmt([{"date": "2026-06-01", "amount": 0, "balance": 25000.0},
               {"date": "2026-06-28", "amount": 0, "balance": 25000.0}],
              start="2026-06-01", end="2026-06-28", opening=25000.0, holder="Unrelated Person")
    result = evaluate(s, _passing_uk_context(), "uk")
    assert _rule(result, "account_holder_match")["status"] == "fail"


def test_sponsor_holder_accepted():
    ctx = _passing_uk_context()
    ctx["sponsor_names"] = ["Muhammad Aslam Khan"]
    s = _stmt([{"date": "2026-06-01", "amount": 0, "balance": 25000.0},
               {"date": "2026-06-28", "amount": 0, "balance": 25000.0}],
              start="2026-06-01", end="2026-06-28", opening=25000.0, holder="Muhammad Aslam Khan")
    result = evaluate(s, ctx, "uk")
    assert _rule(result, "account_holder_match")["status"] == "pass"


def test_large_deposit_inside_window_flagged():
    txns = [
        {"date": "2026-06-01", "amount": 0, "balance": 25000.0},
        {"date": "2026-06-25", "amount": 18000.0, "balance": 43000.0},   # large, late
        {"date": "2026-06-28", "amount": 0, "balance": 43000.0},
    ]
    s = _stmt(txns, start="2026-06-01", end="2026-06-28", opening=25000.0, closing=43000.0)
    result = evaluate(s, _passing_uk_context(), "uk")
    assert _rule(result, "large_deposits")["status"] == "warn"


def test_non_gbp_without_rate_fails_conversion():
    s = _stmt([{"date": "2026-06-01", "amount": 0, "balance": 5_000_000.0},
               {"date": "2026-06-28", "amount": 0, "balance": 5_000_000.0}],
              start="2026-06-01", end="2026-06-28", opening=5_000_000.0, currency="PKR")
    result = evaluate(s, _passing_uk_context(), "uk")
    assert _rule(result, "currency_conversion")["status"] == "fail"


def test_non_gbp_with_rate_converts_and_passes():
    ctx = _passing_uk_context()
    ctx["fx_rate_to_gbp"] = 0.0028   # ~ PKR→GBP
    # 10,000,000 PKR * 0.0028 = 28,000 GBP, above the 20,000 requirement.
    s = _stmt([{"date": "2026-06-01", "amount": 0, "balance": 10_000_000.0},
               {"date": "2026-06-28", "amount": 0, "balance": 10_000_000.0}],
              start="2026-06-01", end="2026-06-28", opening=10_000_000.0, currency="PKR")
    result = evaluate(s, ctx, "uk")
    assert _rule(result, "currency_conversion")["status"] == "warn"
    assert _rule(result, "maintenance_28day_minimum")["status"] == "pass"


def test_required_amount_computed_from_tuition_when_not_given():
    ctx = {
        "applicant_name": "Ahmed Raza Khan",
        "application_date": "2026-07-05",
        "tuition_fee": 12000, "deposit_paid": 2000,
        "course_location": "outside", "course_months": 9,
    }
    s = _stmt([{"date": "2026-06-01", "amount": 0, "balance": 25000.0},
               {"date": "2026-06-28", "amount": 0, "balance": 25000.0}],
              start="2026-06-01", end="2026-06-28", opening=25000.0)
    result = evaluate(s, ctx, "uk")
    # remaining tuition 10,000 + outside maintenance (1,136*9 = 10,224) = 20,224
    assert result["required_amount"] == 20224.0
