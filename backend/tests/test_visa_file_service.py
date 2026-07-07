"""
tests/test_visa_file_service.py

Unit tests for the pure (non-DB) helpers in visa_file_service.py:
  _generate_items   — status default + status preservation on regeneration
  _compute_stats    — completion math, critical counts
  _compute_categories — per-category progress + critical_missing
  _next_actions     — outstanding-critical messaging, complete-file messaging
  serialize_file    — full dashboard-ready payload shape

DB-touching functions (fetch_or_create_file, update_item_status, queries) are
covered indirectly via the engine + these helpers; they are thin SQLAlchemy
wrappers.
"""

from datetime import datetime
from types import SimpleNamespace

from services.visa_file_service import (
    _generate_items,
    _compute_stats,
    _compute_categories,
    _next_actions,
    serialize_file,
)


# ---------------------------------------------------------------------------
# Fixtures / builders
# ---------------------------------------------------------------------------

def _profile(**kw):
    base = {
        "primary_country": "uk", "funding_source": None, "sponsor_relationship": None,
        "previous_refusal": None, "study_gap": None, "dependants": None,
        "study_level": None, "admission_status": None,
    }
    base.update(kw)
    return SimpleNamespace(**base)


def _check(country="uk", **kw):
    base = {
        "country": country, "score": 60, "result": "Needs Work", "visa_type": "student_visa",
        "critical_blockers": [], "high_risk_flags": [], "soft_warnings": [],
    }
    base.update(kw)
    return SimpleNamespace(**base)


def _items(*specs):
    """specs: (priority, status) tuples → minimal item dicts in one category."""
    out = []
    for i, (priority, status) in enumerate(specs):
        out.append({
            "id": f"i{i}", "title": f"t{i}", "category": "identity",
            "priority": priority, "status": status, "reason": "", "guidance": "",
        })
    return out


# ---------------------------------------------------------------------------
# _generate_items
# ---------------------------------------------------------------------------

def test_generate_items_default_status_is_missing():
    items = _generate_items(_profile(), _check(), "uk")
    assert items, "expected a non-empty checklist"
    assert all(it["status"] == "missing" for it in items)


def test_generate_items_preserves_previous_statuses():
    first = _generate_items(_profile(), _check(), "uk")
    # User marks the passport item as available.
    for it in first:
        if it["id"] == "passport":
            it["status"] = "available"

    # Regenerate with the same inputs, carrying previous statuses.
    regenerated = _generate_items(_profile(), _check(), "uk", previous=first)
    passport = next(it for it in regenerated if it["id"] == "passport")
    assert passport["status"] == "available"
    # Other items still default to missing.
    others = [it for it in regenerated if it["id"] != "passport"]
    assert all(it["status"] == "missing" for it in others)


def test_generate_items_ignores_invalid_previous_status():
    first = _generate_items(_profile(), _check(), "uk")
    first[0]["status"] = "bogus_status"
    regen = _generate_items(_profile(), _check(), "uk", previous=first)
    # Invalid status is dropped → falls back to default.
    assert regen[0]["status"] == "missing"


def test_generate_items_reflects_profile_conditionals():
    items = _generate_items(_profile(funding_source="family_sponsored"), _check(), "uk")
    assert any(it["id"] == "sponsor_letter" for it in items)


# ---------------------------------------------------------------------------
# _compute_stats
# ---------------------------------------------------------------------------

def test_stats_all_missing():
    items = _items(("critical", "missing"), ("high", "missing"), ("standard", "missing"))
    stats = _compute_stats(items)
    assert stats["total_items"] == 3
    assert stats["completed"] == 0
    assert stats["missing_total"] == 3
    assert stats["critical_total"] == 1
    assert stats["critical_missing"] == 1
    assert stats["completion_pct"] == 0


def test_stats_resolved_counts_available_and_not_applicable():
    items = _items(
        ("critical", "available"),
        ("high", "not_applicable"),
        ("standard", "missing"),
        ("standard", "in_progress"),
    )
    stats = _compute_stats(items)
    assert stats["completed"] == 2            # available + not_applicable
    assert stats["missing_total"] == 2        # missing + in_progress
    assert stats["completion_pct"] == 50      # 2 / 4
    assert stats["critical_total"] == 1
    assert stats["critical_missing"] == 0     # the only critical is available


def test_stats_critical_missing_excludes_resolved():
    items = _items(("critical", "available"), ("critical", "missing"), ("critical", "needs_review"))
    stats = _compute_stats(items)
    assert stats["critical_total"] == 3
    assert stats["critical_missing"] == 2     # missing + needs_review (not resolved)


def test_stats_empty_list():
    stats = _compute_stats([])
    assert stats["total_items"] == 0
    assert stats["completion_pct"] == 0


# ---------------------------------------------------------------------------
# _compute_categories
# ---------------------------------------------------------------------------

def test_categories_grouped_and_ordered():
    items = [
        {"id": "a", "category": "story", "priority": "high", "status": "missing"},
        {"id": "b", "category": "identity", "priority": "critical", "status": "available"},
        {"id": "c", "category": "identity", "priority": "standard", "status": "missing"},
    ]
    cats = _compute_categories(items)
    keys = [c["key"] for c in cats]
    # identity comes before story in CATEGORY_ORDER.
    assert keys == ["identity", "story"]
    identity = cats[0]
    assert identity["total"] == 2
    assert identity["completed"] == 1
    assert identity["critical"] == 1
    assert identity["critical_missing"] == 0   # the critical identity item is available


# ---------------------------------------------------------------------------
# _next_actions
# ---------------------------------------------------------------------------

def test_next_actions_surfaces_outstanding_critical():
    items = [
        {"id": "a", "title": "CAS", "category": "admission", "priority": "critical", "status": "missing"},
        {"id": "b", "title": "TB test", "category": "country_specific", "priority": "critical", "status": "missing"},
    ]
    stats = _compute_stats(items)
    actions = _next_actions(items, stats)
    assert any("2 critical" in a for a in actions)
    assert any("CAS" in a for a in actions)


def test_next_actions_when_complete():
    items = _items(("critical", "available"), ("high", "available"))
    stats = _compute_stats(items)
    actions = _next_actions(items, stats)
    assert len(actions) == 1
    assert "complete" in actions[0].lower()


def test_next_actions_no_critical_left_but_not_complete():
    items = _items(("critical", "available"), ("standard", "missing"))
    stats = _compute_stats(items)
    actions = _next_actions(items, stats)
    assert any("critical items are handled" in a.lower() for a in actions)


# ---------------------------------------------------------------------------
# serialize_file
# ---------------------------------------------------------------------------

def test_serialize_file_shape():
    items = _generate_items(_profile(funding_source="family_sponsored"), _check(), "uk")
    fake = SimpleNamespace(
        id="file-1",
        visa_check_id="check-1",
        country="uk",
        visa_type="student_visa",
        items=items,
        financial_proof=None,
        sponsor_evidence=None,
        created_at=datetime(2026, 6, 19, 12, 0, 0),
        updated_at=datetime(2026, 6, 19, 12, 0, 0),
    )
    out = serialize_file(fake)
    assert out["id"] == "file-1"
    assert out["visa_check_id"] == "check-1"
    assert out["country"] == "uk"
    assert isinstance(out["items"], list) and out["items"]
    assert isinstance(out["categories"], list)
    assert isinstance(out["category_meta"], list)
    assert out["stats"]["total_items"] == len(items)
    assert isinstance(out["next_actions"], list) and out["next_actions"]
    # ISO timestamps
    assert out["created_at"].startswith("2026-06-19")


def test_serialize_file_handles_null_check_link():
    fake = SimpleNamespace(
        id="file-2", visa_check_id=None, country="uk", visa_type="student_visa",
        items=[], financial_proof=None, sponsor_evidence=None,
        created_at=datetime(2026, 6, 19), updated_at=datetime(2026, 6, 19),
    )
    out = serialize_file(fake)
    assert out["visa_check_id"] is None
    assert out["stats"]["total_items"] == 0
