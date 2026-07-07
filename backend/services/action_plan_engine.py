"""
action_plan_engine.py

Module A: Personalized Action Plan engine.

Pure function — no DB, no I/O. The router owns persistence/serialization.
(Same contract as services/financial_proof_engine.py.)

Turns a completed readiness check into a *ranked, deduplicated* to-do list. Every
issue the readiness engine already surfaced (critical_blockers, high_risk_flags,
soft_warnings, the backward-compat per-question warnings) becomes one actionable
step, and — when supplied — any not-yet-complete VisaFile checklist items are
folded in too.

Each step:
  {
    id:              str,   # stable, derived from the source question/item id
    title:           str,   # short imperative — what to do
    why:             str,   # the underlying problem (officer's concern)
    how:             str,   # concrete next action
    severity:        str,   # "critical" | "high" | "soft" | "todo"
    category:        str,   # risk_category / checklist category, else "general"
    source:          dict | None,  # {url?, ids?} — official citation when known
    related_item_id: str,   # question_id / checklist item id to deep-link
    effort:          str,   # "high" | "medium" | "low"
  }
"""

from typing import Any, Optional

# Rank order — lower sorts first. Drives both ordering and dedupe precedence.
_SEVERITY_RANK: dict[str, int] = {
    "critical": 0,
    "high":     1,
    "soft":     2,
    "todo":     3,
}

_EFFORT_BY_SEVERITY: dict[str, str] = {
    "critical": "high",
    "high":     "medium",
    "soft":     "low",
    "todo":     "low",
}

# VisaFile checklist `priority` → action-plan severity.
_PRIORITY_TO_SEVERITY: dict[str, str] = {
    "critical": "critical",
    "high":     "high",
    "medium":   "soft",
    "low":      "todo",
}

_HOW_BY_SEVERITY: dict[str, str] = {
    "critical": "Resolve this before you apply — it can lead to a refusal on its own.",
    "high":     "Fix this well before lodging; it is a common refusal reason.",
    "soft":     "Tidy this up to strengthen your application.",
    "todo":     "Prepare this document and mark it done when ready.",
}


def _humanize(qid: str) -> str:
    """`uk_first_year_tuition_fee` → `First year tuition fee` (best-effort title)."""
    if not qid:
        return "Flagged item"
    parts = qid.split("_")
    # Drop a leading country/prefix token (uk, usa, can, aus, fin, spn, …).
    if len(parts) > 1 and len(parts[0]) <= 3:
        parts = parts[1:]
    text = " ".join(parts).strip()
    return text[:1].upper() + text[1:] if text else "Flagged item"


def _source_from(issue: dict) -> Optional[dict]:
    """Build a citation dict from an issue's source_url / source_ids, if any."""
    url = issue.get("source_url")
    ids = issue.get("source_ids") or []
    if url and ids:
        return {"url": url, "ids": ids}
    if url:
        return {"url": url}
    if ids:
        return {"ids": ids}
    return None


def _step_from_issue(issue: dict, severity: str) -> Optional[dict]:
    """Convert one readiness-engine issue dict into an action step."""
    if not isinstance(issue, dict):
        return None
    qid = issue.get("question_id") or ""
    rule = (issue.get("rule") or "").strip()
    message = (issue.get("message") or "").strip()

    title = rule or _humanize(qid)
    return {
        "id":              f"step_{severity}_{qid or 'item'}",
        "title":           title,
        "why":             message or title,
        "how":             _HOW_BY_SEVERITY[severity],
        "severity":        severity,
        "category":        issue.get("severity") or "general",  # engine puts risk_category here
        "source":          _source_from(issue),
        "related_item_id": qid,
        "effort":          _EFFORT_BY_SEVERITY[severity],
    }


def _step_from_file_item(item: dict) -> Optional[dict]:
    """Convert an incomplete VisaFile checklist item into an action step."""
    if not isinstance(item, dict):
        return None
    item_id = item.get("id") or ""
    severity = _PRIORITY_TO_SEVERITY.get((item.get("priority") or "").lower(), "todo")
    title = (item.get("title") or _humanize(item_id)).strip()
    return {
        "id":              f"step_doc_{item_id or 'item'}",
        "title":           title,
        "why":             (item.get("reason") or "").strip() or title,
        "how":             (item.get("guidance") or "").strip() or _HOW_BY_SEVERITY[severity],
        "severity":        severity,
        "category":        item.get("category") or "documents",
        "source":          _source_from(item),
        "related_item_id": item_id,
        "effort":          _EFFORT_BY_SEVERITY[severity],
    }


# Statuses on a VisaFile item that mean "no action needed".
_DONE_STATUSES = {"complete", "completed", "done", "ready", "not_applicable", "na"}


def build_plan(
    check_result: dict,
    profile: Any = None,
    file_items: Optional[list[dict]] = None,
) -> list[dict]:
    """
    Build the ranked, deduplicated action plan.

    `check_result` keys used (all optional, handled gracefully):
      critical_blockers, high_risk_flags, soft_warnings, warnings — lists of
      issue dicts as produced by readiness_engine.evaluate().

    `file_items` — optional VisaFile.items; incomplete ones become extra steps.
    `profile` — accepted for future personalization; unused for now.

    Dedupe key is `related_item_id`; when the same id appears at multiple
    severities the most severe wins. Items without an id never collide.
    """
    candidates: list[dict] = []

    for issue in check_result.get("critical_blockers") or []:
        candidates.append(_step_from_issue(issue, "critical"))
    for issue in check_result.get("high_risk_flags") or []:
        candidates.append(_step_from_issue(issue, "high"))
    for issue in check_result.get("soft_warnings") or []:
        candidates.append(_step_from_issue(issue, "soft"))
    for issue in check_result.get("warnings") or []:
        candidates.append(_step_from_issue(issue, "soft"))

    for item in file_items or []:
        if (item.get("status") or "").lower() in _DONE_STATUSES:
            continue
        candidates.append(_step_from_file_item(item))

    # Dedupe by related_item_id, keeping the most severe (lowest rank).
    best_by_key: dict[str, dict] = {}
    anonymous: list[dict] = []
    for step in candidates:
        if step is None:
            continue
        key = step["related_item_id"]
        if not key:
            anonymous.append(step)
            continue
        existing = best_by_key.get(key)
        if existing is None or _SEVERITY_RANK[step["severity"]] < _SEVERITY_RANK[existing["severity"]]:
            best_by_key[key] = step

    steps = list(best_by_key.values()) + anonymous
    steps.sort(key=lambda s: _SEVERITY_RANK[s["severity"]])
    return steps
