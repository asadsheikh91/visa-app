"""
journey_service.py — Module 4: the guided journey.

Turns the siloed modules into one ordered spine — profile → readiness → fix
issues → financial → documents → (interview) → apply — with a single
"% ready to apply" and one clear next action.

Pure function: the router gathers the user's state from the DB and passes it in;
this module owns only the ordering, status, and progress logic.
"""

from __future__ import annotations

from typing import Optional

# Step statuses.
DONE = "done"
CURRENT = "current"   # the one step the user should act on now
TODO = "todo"
BLOCKED = "blocked"   # incomplete AND a hard problem is known (e.g. failing finances)

# Canonical step order. `weight` contributes to the overall %; coaching steps
# (interview) have weight 0 so they don't gate "ready to apply". `apply` is the
# terminal step and also weight 0 (it's the destination, not progress).
_STEPS = [
    {"id": "profile",    "label": "Complete your profile",     "weight": 1, "href": "/onboarding"},
    {"id": "readiness",  "label": "Run a readiness check",     "weight": 1, "href": "/tools/student-visa/countries"},
    {"id": "fix_issues", "label": "Resolve blockers & flags",  "weight": 1, "href": "/dashboard?section=action_plan"},
    {"id": "financial",  "label": "Verify your finances",      "weight": 1, "href": "/tools/financial-document"},
    {"id": "documents",  "label": "Complete your documents",   "weight": 1, "href": "/dashboard?section=visa_file"},
    {"id": "interview",  "label": "Practise the interview",    "weight": 0, "href": "/tools/mock-interview"},
    {"id": "apply",      "label": "You're ready to apply",     "weight": 0, "href": None},
]


def _is_done(step_id: str, s: dict) -> bool:
    if step_id == "profile":
        return bool(s.get("onboarding_completed"))
    if step_id == "readiness":
        return bool(s.get("has_check"))
    if step_id == "fix_issues":
        return bool(s.get("has_check")) and int(s.get("critical_blockers", 0)) == 0 \
            and int(s.get("high_risk_flags", 0)) == 0
    if step_id == "financial":
        return s.get("financial_status") == "pass"
    if step_id == "documents":
        return int(s.get("checklist_total", 0)) > 0 and int(s.get("checklist_critical_missing", 0)) == 0
    if step_id == "interview":
        return bool(s.get("interview_completed"))
    if step_id == "apply":
        # Done only once the user has reported they applied/decided.
        return s.get("outcome") in ("approved", "refused", "withdrawn")
    return False


def _is_blocked(step_id: str, s: dict) -> bool:
    if step_id == "fix_issues":
        return bool(s.get("has_check")) and (
            int(s.get("critical_blockers", 0)) > 0 or int(s.get("high_risk_flags", 0)) > 0
        )
    if step_id == "financial":
        return s.get("financial_status") in ("fail",)
    return False


def _detail(step_id: str, s: dict) -> str:
    if step_id == "profile":
        return "Your profile personalises every check and document list."
    if step_id == "readiness":
        if s.get("has_check"):
            return f"Latest readiness score: {s.get('check_score')}."
        return "Get your personalised readiness score in ~2 minutes."
    if step_id == "fix_issues":
        cb, hf = int(s.get("critical_blockers", 0)), int(s.get("high_risk_flags", 0))
        if not s.get("has_check"):
            return "Run a readiness check first to see any issues."
        if cb or hf:
            return f"{cb} critical blocker(s) and {hf} high-risk flag(s) to resolve."
        return "No blockers or high-risk flags — nicely done."
    if step_id == "financial":
        st = s.get("financial_status")
        if st == "pass":
            return "Your statement meets the financial rules we checked."
        if st == "fail":
            return "Your statement doesn't meet the rules yet — see the failed checks."
        if st == "warn":
            return "Some financial items need confirmation or more evidence."
        return "Upload your bank statement to check it against the rules."
    if step_id == "documents":
        total = int(s.get("checklist_total", 0))
        miss = int(s.get("checklist_critical_missing", 0))
        if total == 0:
            return "Build your document checklist from a readiness check."
        if miss:
            return f"{miss} critical document(s) still outstanding."
        return "All critical documents are in place."
    if step_id == "interview":
        return "Optional but recommended — rehearse a credibility interview."
    if step_id == "apply":
        return "When everything above is green, lodge your application with confidence."
    return ""


def build_journey(state: dict) -> dict:
    """
    Build the ordered journey from a flat state dict. See router for the keys.

    Returns:
      { steps: [{id,label,status,detail,href,weight}],
        overall_pct, next_step_id, next_action_label, complete }
    """
    s = state or {}
    steps: list[dict] = []
    current_assigned = False

    for spec in _STEPS:
        sid = spec["id"]
        done = _is_done(sid, s)
        if done:
            status = DONE
        elif _is_blocked(sid, s):
            status = BLOCKED
            if not current_assigned:
                current_assigned = True  # a blocked step is the thing to act on
        elif not current_assigned:
            status = CURRENT
            current_assigned = True
        else:
            status = TODO
        steps.append({
            "id": sid, "label": spec["label"], "status": status,
            "detail": _detail(sid, s), "href": spec["href"], "weight": spec["weight"],
        })

    weighted_total = sum(sp["weight"] for sp in _STEPS) or 1
    weighted_done = sum(st["weight"] for st in steps if st["status"] == DONE)
    overall_pct = round(100 * weighted_done / weighted_total)

    # Next action = first step that is current or blocked.
    next_step = next((st for st in steps if st["status"] in (CURRENT, BLOCKED)), None)
    complete = all(st["status"] == DONE for st in steps if st["weight"] > 0)

    return {
        "steps": steps,
        "overall_pct": overall_pct,
        "next_step_id": next_step["id"] if next_step else None,
        "next_action_label": next_step["label"] if next_step else "You're ready to apply",
        "complete": complete,
    }
