"""
tests/test_timeline_engine.py

Unit tests for the Timeline & Deadline Planner (Module C):
  - timeline_engine.build_timeline (pure)
  - timeline_service.parse_intake_date / _carry_over_edits (pure helpers)

No I/O, no DB.
"""

from datetime import date

import pytest

from services.timeline_engine import build_timeline, VALID_TIMELINE_STATUSES
from services.timeline_service import parse_intake_date, _carry_over_edits


INTAKE = date(2026, 9, 1)


def test_milestones_sorted_and_before_intake():
    ms = build_timeline(INTAKE, "uk")
    dues = [m["due_date"] for m in ms]
    assert dues == sorted(dues)                       # ascending
    assert ms[-1]["id"] == "course_start"            # intake is last
    assert ms[-1]["due_date"] == INTAKE.isoformat()
    # every other milestone is on/before the intake date
    assert all(m["due_date"] <= INTAKE.isoformat() for m in ms)


def test_country_specific_enrolment_label():
    uk = {m["id"]: m for m in build_timeline(INTAKE, "uk")}
    usa = {m["id"]: m for m in build_timeline(INTAKE, "usa")}
    assert "CAS" in uk["enrolment_doc"]["label"]
    assert "I-20" in usa["enrolment_doc"]["label"]


def test_country_specific_local_requirement():
    usa = {m["id"]: m for m in build_timeline(INTAKE, "usa")}
    canada = {m["id"]: m for m in build_timeline(INTAKE, "canada")}
    assert "SEVIS" in usa["local_requirement"]["label"]
    assert "GIC" in canada["local_requirement"]["label"]


def test_sourced_milestones_carry_official_url():
    ms = {m["id"]: m for m in build_timeline(INTAKE, "uk")}
    assert ms["apply_visa"]["source"] and ms["apply_visa"]["source"].startswith("https://")
    assert ms["financial_proof"]["source"]
    assert ms["prepare_travel"]["source"] is None


def test_default_status_is_upcoming():
    ms = build_timeline(INTAKE, "australia")
    assert all(m["status"] == "upcoming" for m in ms)
    assert "upcoming" in VALID_TIMELINE_STATUSES


def test_unknown_country_still_builds():
    ms = build_timeline(INTAKE, "narnia")
    assert len(ms) >= 5
    # generic enrolment label, no official source url
    by_id = {m["id"]: m for m in ms}
    assert by_id["apply_visa"]["source"] is None


# ── parse_intake_date ────────────────────────────────────────────────────────

def test_parse_intake_date_ok():
    assert parse_intake_date("2026-09-01") == date(2026, 9, 1)


def test_parse_intake_date_bad():
    with pytest.raises(ValueError):
        parse_intake_date("not-a-date")
    with pytest.raises(ValueError):
        parse_intake_date("")


# ── _carry_over_edits ────────────────────────────────────────────────────────

def test_carry_over_preserves_status_and_note():
    fresh = build_timeline(INTAKE, "uk")
    previous = [{"id": "apply_visa", "status": "done", "note": "submitted online"}]
    merged = {m["id"]: m for m in _carry_over_edits(fresh, previous)}
    assert merged["apply_visa"]["status"] == "done"
    assert merged["apply_visa"]["note"] == "submitted online"
    # untouched milestones keep their default
    assert merged["biometrics"]["status"] == "upcoming"


def test_carry_over_ignores_invalid_status():
    fresh = build_timeline(INTAKE, "uk")
    previous = [{"id": "apply_visa", "status": "bogus"}]
    merged = {m["id"]: m for m in _carry_over_edits(fresh, previous)}
    assert merged["apply_visa"]["status"] == "upcoming"
