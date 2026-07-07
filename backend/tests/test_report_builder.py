"""
tests/test_report_builder.py

Integration tests for report_builder.build_report against the Definition-of-Done,
using the repo's no-real-DB pattern (a mock AsyncSession) plus a REAL Fernet key so
the PII-at-rest path is genuinely exercised.

Covers:
  - Fact integrity   — every number in ReportData traces to the engine; severities
                       come from the bucket, not the narrator.
  - Resilience       — Gemini unavailable ⇒ report still builds with fallback prose.
  - Schema safety    — Gemini raising NarrationError ⇒ fallback (no crash).
  - AI happy path    — valid Gemini narration ⇒ narrated_by_ai True, AI prose used.
  - Determinism      — an identical prior build is returned (no re-narration).
  - PII at rest      — persisted payload is a Fernet envelope that round-trips.
"""

import asyncio
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from cryptography.fernet import Fernet

from schemas.report import GeminiNarration
from services import report_builder as rb


# ---------------------------------------------------------------------------
# Fixtures: fake country data, check, user, session
# ---------------------------------------------------------------------------

_QUESTIONS = [
    {"id": "q_funds", "question": "Do you have the funds?", "risk_category": "financial",
     "score_impact": 10, "help_text": "Funds must meet the minimum.",
     "validation": {"pass_if": {"type": "gte", "value": 20000}}},
    {"id": "q_lang", "question": "Is your language score competitive?", "risk_category": "language",
     "score_impact": 10, "help_text": "Language should be competitive.",
     "pass_if": {"type": "eq", "value": "yes"}},
]

_SCORING = {
    "score_bands": [
        {"min": 85, "max": 100, "label": "Strong Readiness", "description": "Strong."},
        {"min": 65, "max": 84,  "label": "Ready",            "description": "Ready."},
        {"min": 40, "max": 64,  "label": "Conditional",      "description": "Conditional."},
        {"min": 0,  "max": 39,  "label": "High Refusal Risk","description": "High risk."},
    ],
    "scoring_categories": [
        {"category_id": "finance",  "label": "Finances",  "max_points": 50, "question_ids": ["q_funds"]},
        {"category_id": "language", "label": "Language",  "max_points": 50, "question_ids": ["q_lang"]},
    ],
    "critical_blockers_hard": [],
    "high_risk_flags": [],
    "soft_warnings": [],
    "config": {},
}


def _make_check():
    check = MagicMock()
    check.id = uuid.uuid4()
    check.user_id = uuid.uuid4()
    check.country = "canada"
    check.score = 30
    check.result = "High Refusal Risk"
    check.critical_blockers = [
        {"question_id": "q_funds", "message": "Declared funds are below the required minimum.",
         "rule": "Proof of funds", "severity": "financial"}
    ]
    check.high_risk_flags = [
        {"question_id": "q_lang", "message": "Language score is below the competitive band.",
         "rule": "Language score", "severity": "language"}
    ]
    check.soft_warnings = []
    check.normalized_answers = {"q_funds": 10000.0, "q_lang": "no"}
    check.created_at = datetime(2026, 7, 3, 10, 0, 0)
    return check


def _make_user(uid):
    user = MagicMock()
    user.id = uid
    user.plan = "pro"
    return user


def _session(existing_report=None):
    """Mock AsyncSession. execute() → result whose scalars().first() is `existing_report`."""
    session = MagicMock()
    result = MagicMock()
    result.scalars.return_value.first.return_value = existing_report
    session.execute = AsyncMock(return_value=result)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture(autouse=True)
def _patch_country_data(monkeypatch):
    monkeypatch.setattr(rb, "load_questions", lambda vt, c: list(_QUESTIONS))
    monkeypatch.setattr(rb, "load_scoring", lambda vt, c: dict(_SCORING))
    monkeypatch.setattr(rb, "normalize_questions", lambda qs: qs)
    # Encryption key so the PII path runs for real.
    monkeypatch.setenv("FIELD_ENCRYPTION_KEY", Fernet.generate_key().decode())
    # Narration cache disabled (no Redis in tests).
    monkeypatch.setattr(rb.report_cache, "get_cached_narration", lambda k: None)
    monkeypatch.setattr(rb.report_cache, "set_cached_narration", lambda k, v: None)


def _build(session, check, user, profile=None):
    return asyncio.run(rb.build_report(session, user, check, profile))


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_fallback_when_gemini_unavailable(monkeypatch):
    """Gemini not configured ⇒ report still builds; narrated_by_ai is False."""
    monkeypatch.setattr(rb, "gemini_available", lambda: False)
    check = _make_check()
    user = _make_user(check.user_id)
    session = _session()

    report = _build(session, check, user)

    assert report.narrated_by_ai is False
    assert session.add.called and session.commit.await_count == 1
    data = rb.decrypt_report_data(report)
    assert len(data["findings"]) == 2  # one critical + one high


def test_fact_integrity_numbers_and_severity(monkeypatch):
    monkeypatch.setattr(rb, "gemini_available", lambda: False)
    check = _make_check()
    user = _make_user(check.user_id)

    report = _build(_session(), check, user)
    data = rb.decrypt_report_data(report)

    # Overall score is exactly the engine's score.
    assert data["overallScore"] == 30
    assert data["bandPositionPct"] == 30
    assert data["band"] == "High Refusal Risk"
    # CRS not applicable for student visa.
    assert data["estCrs"] is None

    # Severity comes from the bucket, not the narrator.
    by_title = {f["title"]: f for f in data["findings"]}
    assert by_title["Proof of funds"]["severity"] == "critical"
    assert by_title["Language score"]["severity"] == "high"

    # Criterion scores match the engine breakdown (both categories fail → 0).
    scores = {c["key"]: c["score"] for c in data["criteria"]}
    assert scores["finance"] == 0 and scores["language"] == 0
    assert all(c["fill"] == "crit" for c in data["criteria"])

    # Meter bands come straight from scoring.json.
    assert [b["label"] for b in data["bands"]][0] == "High Refusal Risk"  # sorted by min asc


def test_fallback_prose_introduces_no_foreign_numbers(monkeypatch):
    monkeypatch.setattr(rb, "gemini_available", lambda: False)
    check = _make_check()
    report = _build(_session(), check, _make_user(check.user_id))
    data = rb.decrypt_report_data(report)
    for f in data["findings"]:
        blob = " ".join([f["explanation"], f["impact"], *f["fixSteps"], *f["bestPractices"]])
        assert not any(ch.isdigit() for ch in blob), f"foreign number in {f['id']}"


def test_ai_narration_used_when_available(monkeypatch):
    monkeypatch.setattr(rb, "gemini_available", lambda: True)

    def _fake_narrate(inputs):
        return [GeminiNarration(id=i.id, explanation=f"AI-EXPLAIN {i.id}", impact="AI-IMPACT",
                                fixSteps=["AI step"], bestPractices=["AI practice"]) for i in inputs]

    monkeypatch.setattr(rb, "gemini_narrate", _fake_narrate)
    check = _make_check()
    report = _build(_session(), check, _make_user(check.user_id))

    assert report.narrated_by_ai is True
    data = rb.decrypt_report_data(report)
    assert all(f["explanation"].startswith("AI-EXPLAIN") for f in data["findings"])


def test_narration_error_falls_back(monkeypatch):
    monkeypatch.setattr(rb, "gemini_available", lambda: True)

    def _boom(inputs):
        raise rb.NarrationError("gemini 500")

    monkeypatch.setattr(rb, "gemini_narrate", _boom)
    check = _make_check()
    report = _build(_session(), check, _make_user(check.user_id))

    assert report.narrated_by_ai is False  # fell back
    data = rb.decrypt_report_data(report)
    assert len(data["findings"]) == 2  # still complete


def test_idempotent_returns_existing_without_rebuild(monkeypatch):
    monkeypatch.setattr(rb, "gemini_available", lambda: False)
    check = _make_check()
    user = _make_user(check.user_id)

    existing = MagicMock()
    existing.token = "pre-existing-token"
    session = _session(existing_report=existing)

    report = _build(session, check, user)

    assert report is existing
    assert not session.add.called  # no rebuild, no new row
    assert session.commit.await_count == 0


def test_pii_encrypted_at_rest_and_roundtrips(monkeypatch):
    monkeypatch.setattr(rb, "gemini_available", lambda: False)
    from services import encryption

    profile = MagicMock()
    profile.preferred_name = "Ahmed Raza Khan"
    profile.study_level = "Masters"
    profile.dependants = "None"

    check = _make_check()
    report = _build(_session(), check, _make_user(check.user_id), profile)

    # Stored column is a Fernet envelope, NOT plaintext.
    assert encryption.is_envelope(report.data_encrypted)
    assert "Ahmed" not in str(report.data_encrypted)  # name not in ciphertext envelope

    data = rb.decrypt_report_data(report)
    assert data["applicant"]["name"] == "Ahmed Raza Khan"
    assert data["applicant"]["targetCountry"] == "Canada"


def test_report_id_and_token_are_distinct(monkeypatch):
    monkeypatch.setattr(rb, "gemini_available", lambda: False)
    check = _make_check()
    report = _build(_session(), check, _make_user(check.user_id))
    # Human-readable id vs unguessable token — different values, token is long.
    assert report.report_id.startswith("PV-CA-")
    assert report.token != report.report_id
    assert len(report.token) >= 32


# ---------------------------------------------------------------------------
# Band single source of truth (regression for the 87/"High Refusal Risk" bug)
# ---------------------------------------------------------------------------

def test_band_derived_from_score_not_stored_label(monkeypatch):
    """A legacy check row where the stored result label diverged from the score
    (the pre-fix band-cap bug: score left at 87 while the label was demoted)
    must render a report whose badge, meter marker, and verdict all agree —
    derived from the score, never from the stale stored string."""
    from services.readiness_engine import band_for_score

    monkeypatch.setattr(rb, "gemini_available", lambda: False)
    check = _make_check()
    check.score = 87
    check.result = "High Refusal Risk"  # stale label from the old cap-the-label bug
    check.critical_blockers = []

    report = _build(_session(), check, _make_user(check.user_id))
    data = rb.decrypt_report_data(report)

    # Badge and marker agree: 87 sits in the fixture's 85-100 band.
    assert data["overallScore"] == 87
    assert data["bandPositionPct"] == 87
    assert data["band"] == "Strong Readiness"
    assert data["band"] == band_for_score(data["overallScore"], _SCORING["score_bands"])["label"]

    # The verdict paragraph must match the score-derived band tier, not the
    # stale label: top tier with one high finding → the "competitive" lead,
    # never the "high risk of refusal" lead.
    assert "high risk of refusal" not in data["verdictLead"].lower()


def test_report_band_always_matches_score_band(monkeypatch):
    """Invariant sweep: whatever score the check carries, the persisted report's
    band must be band_for_score(overallScore)."""
    from services.readiness_engine import band_for_score

    monkeypatch.setattr(rb, "gemini_available", lambda: False)
    for score in (0, 39, 40, 64, 65, 84, 85, 100):
        check = _make_check()
        check.score = score
        report = _build(_session(), check, _make_user(check.user_id))
        data = rb.decrypt_report_data(report)
        expected = band_for_score(score, _SCORING["score_bands"])["label"]
        assert data["band"] == expected, f"score {score}: {data['band']!r} != {expected!r}"
