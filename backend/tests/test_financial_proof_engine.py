"""
tests/test_financial_proof_engine.py

Unit tests for the Financial Proof Validator (Module B additions to
financial_proof_engine.py): location/length-aware maintenance + rule_checks.

No I/O, no DB. Pure function only.
"""

from services.financial_proof_engine import evaluate, _maintenance


def _rule(result, rule_id):
    for rc in result["rule_checks"]:
        if rc["rule_id"] == rule_id:
            return rc
    raise AssertionError(f"rule {rule_id!r} not found")


# ---------------------------------------------------------------------------
# Maintenance table — location + months aware (UK)
# ---------------------------------------------------------------------------

def test_uk_london_costs_more_than_outside():
    assert _maintenance("uk", "london", 9) > _maintenance("uk", "outside", 9)


def test_uk_maintenance_capped_at_9_months():
    assert _maintenance("uk", "outside", 12) == _maintenance("uk", "outside", 9)


def test_uk_months_prorated_below_cap():
    assert _maintenance("uk", "outside", 3) < _maintenance("uk", "outside", 9)


def test_non_uk_uses_annual_figure():
    assert _maintenance("australia", "", 0) == _maintenance("australia", "london", 12)


def test_unknown_country_falls_back():
    assert _maintenance("narnia", "", 0) > 0


# ---------------------------------------------------------------------------
# rule_checks contract
# ---------------------------------------------------------------------------

def test_rule_checks_present_and_shaped():
    result = evaluate({}, "uk")
    assert isinstance(result["rule_checks"], list) and result["rule_checks"]
    for rc in result["rule_checks"]:
        assert set(rc) >= {"rule_id", "label", "status", "detail", "threshold", "source"}
        assert rc["status"] in ("pass", "warn", "fail")


def test_maintenance_rule_fails_when_short():
    result = evaluate({"tuition_fee": 20000, "available_funds": 1000}, "uk")
    assert _rule(result, "maintenance_amount")["status"] == "fail"


def test_maintenance_rule_passes_when_funded():
    # Outside-London 9-month maintenance ~10,224; cover tuition + that comfortably.
    result = evaluate(
        {"tuition_fee": 10000, "available_funds": 100000,
         "course_location": "outside", "bank_statement_status": "ready",
         "funds_held_duration": "3_months_plus", "large_deposits": "no"},
        "uk",
    )
    assert _rule(result, "maintenance_amount")["status"] == "pass"


def test_holding_period_rule():
    short = evaluate({"funds_held_duration": "less_than_28_days"}, "uk")
    assert _rule(short, "holding_period_28_days")["status"] == "fail"
    ok = evaluate({"funds_held_duration": "28_days_plus"}, "uk")
    assert _rule(ok, "holding_period_28_days")["status"] == "pass"
    unsure = evaluate({"funds_held_duration": "not_sure"}, "uk")
    assert _rule(unsure, "holding_period_28_days")["status"] == "warn"


def test_sponsor_rule_only_when_sponsored():
    self_funded = evaluate({"funding_source": "self_funded"}, "uk")
    assert all(rc["rule_id"] != "sponsor_income_proof" for rc in self_funded["rule_checks"])
    sponsored = evaluate({"funding_source": "parent_sponsor", "income_proof_available": "no"}, "uk")
    assert _rule(sponsored, "sponsor_income_proof")["status"] == "fail"


def test_large_deposits_rule():
    yes = evaluate({"large_deposits": "yes"}, "uk")
    assert _rule(yes, "large_deposits_explained")["status"] == "fail"
    no = evaluate({"large_deposits": "no"}, "uk")
    assert _rule(no, "large_deposits_explained")["status"] == "pass"


def test_existing_contract_keys_preserved():
    result = evaluate({}, "uk")
    for key in ("strength", "score", "required_estimate", "available_funds",
                "shortfall", "currency", "currency_symbol", "critical_issues",
                "documents_to_prepare", "checklist_injections", "bank_statement_ready"):
        assert key in result
