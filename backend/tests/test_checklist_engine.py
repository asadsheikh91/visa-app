"""
tests/test_checklist_engine.py

Unit tests for the Visa File Builder's rules engine (checklist_engine.py).

No I/O, no DB. Pure functions only.

Coverage:
  build_checklist  — base items, per-country items, conditional items,
                     readiness-derived items, dedupe, category/priority sort
  _short_title     — truncation behaviour
  category_meta    — render order + labels
"""

from services.checklist_engine import (
    build_checklist,
    category_meta,
    _short_title,
    CATEGORY_ORDER,
    CATEGORY_LABELS,
    VALID_STATUSES,
    DEFAULT_STATUS,
    RESOLVED_STATUSES,
)


def _ids(items):
    return {it["id"] for it in items}


# ---------------------------------------------------------------------------
# Base items
# ---------------------------------------------------------------------------

def test_base_items_present_for_every_country():
    for country in ("uk", "usa", "canada", "australia"):
        ids = _ids(build_checklist({}, None, country))
        assert "passport" in ids
        assert "english_test" in ids
        assert "academic_transcripts" in ids


def test_items_have_no_status_from_engine():
    # The engine returns items WITHOUT status — the service adds it.
    for it in build_checklist({}, None, "uk"):
        assert "status" not in it
        assert {"id", "title", "category", "priority", "reason", "guidance"} <= set(it)


# ---------------------------------------------------------------------------
# Country-specific items
# ---------------------------------------------------------------------------

def test_uk_country_items():
    ids = _ids(build_checklist({}, None, "uk"))
    assert {"uk_cas", "uk_tb_test", "uk_financial_maintenance", "uk_atas"} <= ids


def test_usa_country_items():
    ids = _ids(build_checklist({}, None, "usa"))
    assert {"usa_i20", "usa_ds160", "usa_sevis_fee", "usa_visa_appointment", "usa_interview_prep"} <= ids


def test_canada_country_items():
    ids = _ids(build_checklist({}, None, "canada"))
    assert {"can_loa", "can_proof_of_funds", "can_sop", "can_family_ties", "can_pal"} <= ids


def test_australia_country_items():
    ids = _ids(build_checklist({}, None, "australia"))
    assert {"aus_coe", "aus_oshc", "aus_gs_statement", "aus_financial_capacity", "aus_immigration_history"} <= ids


def test_unknown_country_yields_only_base_items():
    items = build_checklist({}, None, "germany")
    ids = _ids(items)
    assert "passport" in ids
    # No country-specific ids leaked in.
    assert not any(i.startswith(("uk_", "usa_", "can_", "aus_")) for i in ids)


def test_country_slug_is_case_insensitive():
    assert "uk_cas" in _ids(build_checklist({}, None, "UK"))


# ---------------------------------------------------------------------------
# Conditional items
# ---------------------------------------------------------------------------

def test_sponsor_items_added_for_family_funding():
    ids = _ids(build_checklist({"funding_source": "family_sponsored"}, None, "uk"))
    assert {"sponsor_letter", "sponsor_bank_statements", "sponsor_relationship_proof"} <= ids


def test_sponsor_items_added_for_parent_relationship():
    ids = _ids(build_checklist({"sponsor_relationship": "parent"}, None, "uk"))
    assert "sponsor_letter" in ids


def test_no_sponsor_items_for_self_funded():
    ids = _ids(build_checklist({"funding_source": "self_funded"}, None, "uk"))
    assert "sponsor_letter" not in ids


def test_refusal_items_added_when_previous_refusal_yes():
    ids = _ids(build_checklist({"previous_refusal": "yes"}, None, "uk"))
    assert {"previous_refusal_letter", "refusal_explanation"} <= ids


def test_no_refusal_items_when_no():
    ids = _ids(build_checklist({"previous_refusal": "no"}, None, "uk"))
    assert "refusal_explanation" not in ids


def test_gap_item_added_when_study_gap_yes():
    ids = _ids(build_checklist({"study_gap": "yes"}, None, "uk"))
    assert "gap_explanation" in ids


def test_dependant_item_added_when_dependants_yes():
    ids = _ids(build_checklist({"dependants": "yes"}, None, "uk"))
    assert "dependant_documents" in ids


def test_empty_profile_adds_no_conditional_items():
    ids = _ids(build_checklist({}, None, "uk"))
    for cid in ("sponsor_letter", "refusal_explanation", "gap_explanation", "dependant_documents"):
        assert cid not in ids


# ---------------------------------------------------------------------------
# Readiness-derived items
# ---------------------------------------------------------------------------

def test_readiness_blocker_becomes_critical_item():
    check = {
        "critical_blockers": [
            {"question_id": "uk_funds", "message": "Funds held under 28 days."}
        ],
        "high_risk_flags": [],
    }
    items = build_checklist({}, check, "uk")
    match = [it for it in items if it["id"] == "fix_blocker_uk_funds"]
    assert len(match) == 1
    assert match[0]["priority"] == "critical"
    assert "Funds held under 28 days." in match[0]["reason"]


def test_readiness_flag_becomes_high_item():
    check = {
        "critical_blockers": [],
        "high_risk_flags": [{"question_id": "gap", "message": "Big study gap."}],
    }
    items = build_checklist({}, check, "uk")
    match = [it for it in items if it["id"] == "fix_flag_gap"]
    assert len(match) == 1
    assert match[0]["priority"] == "high"


def test_no_check_means_no_readiness_items():
    ids = _ids(build_checklist({}, None, "uk"))
    assert not any(i.startswith("fix_") for i in ids)


def test_malformed_readiness_entries_skipped():
    check = {"critical_blockers": ["not a dict", None], "high_risk_flags": []}
    # Should not raise; just skips junk.
    items = build_checklist({}, check, "uk")
    assert not any(i.startswith("fix_blocker_") for i in _ids(items))


# ---------------------------------------------------------------------------
# Dedupe + ordering
# ---------------------------------------------------------------------------

def test_ids_are_unique():
    check = {
        "critical_blockers": [{"question_id": "x", "message": "m"}],
        "high_risk_flags": [{"question_id": "y", "message": "m"}],
    }
    items = build_checklist(
        {"funding_source": "family_sponsored", "previous_refusal": "yes",
         "study_gap": "yes", "dependants": "yes"},
        check, "uk",
    )
    ids = [it["id"] for it in items]
    assert len(ids) == len(set(ids))


def test_items_sorted_by_category_then_priority():
    items = build_checklist({"funding_source": "family_sponsored"}, None, "uk")
    # Category index must be non-decreasing across the list.
    cat_indices = [CATEGORY_ORDER.index(it["category"]) for it in items]
    assert cat_indices == sorted(cat_indices)


# ---------------------------------------------------------------------------
# Helpers / metadata
# ---------------------------------------------------------------------------

def test_short_title_truncates_long_text():
    long = "word " * 50
    out = _short_title(long, limit=60)
    assert len(out) <= 61  # +1 for the ellipsis
    assert out.endswith("…")


def test_short_title_handles_empty():
    assert _short_title("") == "readiness item"


def test_category_meta_matches_order_and_labels():
    meta = category_meta()
    assert [m["key"] for m in meta] == CATEGORY_ORDER
    for m in meta:
        assert m["label"] == CATEGORY_LABELS[m["key"]]


def test_status_vocabulary_constants():
    assert DEFAULT_STATUS in VALID_STATUSES
    assert RESOLVED_STATUSES <= VALID_STATUSES
    assert "available" in RESOLVED_STATUSES
    assert "not_applicable" in RESOLVED_STATUSES
