"""
tests/test_action_plan_engine.py

Unit tests for the Personalized Action Plan engine (action_plan_engine.py).

No I/O, no DB. Pure function only.

Coverage:
  build_plan — severity ranking, dedupe-by-id (most severe wins), file-item
               folding, done-item skipping, source passthrough, empty input.
"""

from services.action_plan_engine import build_plan


def _issue(qid, message="", rule="", **extra):
    d = {"question_id": qid, "message": message, "rule": rule}
    d.update(extra)
    return d


def test_empty_result_yields_no_steps():
    assert build_plan({}) == []
    assert build_plan({"high_risk_flags": [], "warnings": []}) == []


def test_severity_ordering_critical_first():
    result = {
        "soft_warnings":     [_issue("q_soft")],
        "critical_blockers": [_issue("q_crit")],
        "high_risk_flags":   [_issue("q_high")],
    }
    steps = build_plan(result)
    assert [s["severity"] for s in steps] == ["critical", "high", "soft"]


def test_dedupe_keeps_most_severe():
    # Same question id flagged as both high and soft → one step, severity high.
    result = {
        "high_risk_flags": [_issue("dup", rule="Funds rule")],
        "soft_warnings":   [_issue("dup", rule="Funds rule")],
        "warnings":        [_issue("dup")],
    }
    steps = build_plan(result)
    dup_steps = [s for s in steps if s["related_item_id"] == "dup"]
    assert len(dup_steps) == 1
    assert dup_steps[0]["severity"] == "high"


def test_source_passthrough():
    result = {
        "critical_blockers": [
            _issue("q1", source_url="https://gov.uk/x", source_ids=["uk_funds"]),
        ],
    }
    step = build_plan(result)[0]
    assert step["source"] == {"url": "https://gov.uk/x", "ids": ["uk_funds"]}


def test_file_items_folded_and_done_skipped():
    result = {"high_risk_flags": [_issue("q_high", rule="Tuition")]}
    file_items = [
        {"id": "passport", "title": "Passport", "priority": "critical",
         "status": "pending", "category": "documents"},
        {"id": "english_test", "title": "English test", "priority": "high",
         "status": "complete", "category": "documents"},  # done → skipped
    ]
    steps = build_plan(result, None, file_items)
    ids = {s["related_item_id"] for s in steps}
    assert "passport" in ids
    assert "english_test" not in ids
    # critical file item now sorts ahead of the high-severity issue
    assert steps[0]["related_item_id"] == "passport"


def test_step_shape_is_complete():
    step = build_plan({"high_risk_flags": [_issue("uk_funds", message="Low funds", rule="28-day rule")]})[0]
    for key in ("id", "title", "why", "how", "severity", "category",
                "source", "related_item_id", "effort"):
        assert key in step
    assert step["title"] == "28-day rule"
    assert step["why"] == "Low funds"
    assert step["effort"] == "medium"
