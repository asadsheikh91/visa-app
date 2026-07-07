"""
tests/test_journey_service.py

Module 4 pure logic: ordering, per-step status, overall %, and next action.
No DB, no I/O.
"""

from services.journey_service import build_journey, DONE, CURRENT, TODO, BLOCKED


def _step(journey, sid):
    return next(s for s in journey["steps"] if s["id"] == sid)


def test_empty_state_starts_at_profile():
    j = build_journey({})
    assert _step(j, "profile")["status"] == CURRENT
    assert _step(j, "readiness")["status"] == TODO
    assert j["overall_pct"] == 0
    assert j["next_step_id"] == "profile"
    assert j["complete"] is False


def test_profile_done_moves_current_to_readiness():
    j = build_journey({"onboarding_completed": True})
    assert _step(j, "profile")["status"] == DONE
    assert _step(j, "readiness")["status"] == CURRENT
    assert j["overall_pct"] == 20   # 1 of 5 weighted steps


def test_blockers_make_fix_issues_blocked():
    j = build_journey({
        "onboarding_completed": True, "has_check": True, "check_score": 55,
        "critical_blockers": 2, "high_risk_flags": 1,
    })
    assert _step(j, "readiness")["status"] == DONE
    assert _step(j, "fix_issues")["status"] == BLOCKED
    assert j["next_step_id"] == "fix_issues"


def test_financial_fail_is_blocked():
    j = build_journey({
        "onboarding_completed": True, "has_check": True, "check_score": 80,
        "critical_blockers": 0, "high_risk_flags": 0,
        "financial_status": "fail",
    })
    assert _step(j, "fix_issues")["status"] == DONE
    assert _step(j, "financial")["status"] == BLOCKED


def test_documents_done_requires_no_critical_missing():
    base = {
        "onboarding_completed": True, "has_check": True, "check_score": 90,
        "critical_blockers": 0, "high_risk_flags": 0, "financial_status": "pass",
    }
    incomplete = build_journey({**base, "checklist_total": 10, "checklist_critical_missing": 3})
    assert _step(incomplete, "documents")["status"] in (CURRENT, BLOCKED, TODO)
    assert _step(incomplete, "documents")["status"] == CURRENT

    complete = build_journey({**base, "checklist_total": 10, "checklist_critical_missing": 0})
    assert _step(complete, "documents")["status"] == DONE


def test_interview_is_optional_weight_zero():
    # All weighted steps done but no interview → still 100% and complete.
    j = build_journey({
        "onboarding_completed": True, "has_check": True, "check_score": 90,
        "critical_blockers": 0, "high_risk_flags": 0, "financial_status": "pass",
        "checklist_total": 5, "checklist_critical_missing": 0,
        "interview_completed": False,
    })
    assert j["overall_pct"] == 100
    assert j["complete"] is True
    assert _step(j, "interview")["status"] == CURRENT   # surfaced as the next (optional) thing
    assert _step(j, "interview")["weight"] == 0


def test_apply_done_when_outcome_reported():
    j = build_journey({
        "onboarding_completed": True, "has_check": True, "check_score": 90,
        "critical_blockers": 0, "high_risk_flags": 0, "financial_status": "pass",
        "checklist_total": 5, "checklist_critical_missing": 0,
        "interview_completed": True, "outcome": "approved",
    })
    assert _step(j, "apply")["status"] == DONE
    assert all(s["status"] == DONE for s in j["steps"])


def test_overall_pct_partial():
    j = build_journey({
        "onboarding_completed": True, "has_check": True, "check_score": 70,
        "critical_blockers": 0, "high_risk_flags": 0,
    })
    # profile + readiness + fix_issues done = 3/5 = 60%
    assert j["overall_pct"] == 60
