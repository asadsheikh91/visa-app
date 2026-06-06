"""
tests/test_phase4b_persistence.py

Phase 4B — Persistence layer tests.

Coverage:
  save_visa_check()
    — persists high_risk_flags
    — persists soft_warnings
    — persists normalized_answers
    — persists sources_used
    — persists all original Phase 1 fields unchanged
    — defaults to [] / {} when engine omits new fields
    — raises on DB error (rollback called)

  History endpoint (GET /history)
    — returns real persisted high_risk_flags (not placeholder [])
    — returns real persisted soft_warnings
    — returns real persisted normalized_answers
    — returns real persisted sources_used
    — handles old rows with NULL high_risk_flags -> []
    — handles old rows with NULL soft_warnings -> []
    — handles old rows with NULL normalized_answers -> {}
    — handles old rows with NULL sources_used -> []

  check_readiness (POST /{country}/check)
    — passes full engine result to save_visa_check

No real DB. save_visa_check tests use asyncio.run() with a mock session
that captures the VisaCheck object passed to session.add().
"""

import asyncio
import uuid
import pytest
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock, patch, call

from fastapi import FastAPI
from fastapi.testclient import TestClient

from services.user_service import save_visa_check
from auth.base import AuthUser
from auth.dependencies import get_current_user
from database import get_db
from limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from routers import student_visa


# ---------------------------------------------------------------------------
# Shared result_data fixtures
# ---------------------------------------------------------------------------

_FULL_RESULT = {
    "score":              80,
    "result":             "Moderate Risk",
    "result_description": "Some risk.",
    "critical_blockers":  [],
    "high_risk_flags":    [{"question_id": "q_funds", "message": "Fund risk.", "rule": "R"}],
    "soft_warnings":      [{"question_id": "q_gs",    "message": "GS warning.", "rule": "R"}],
    "warnings":           [{"question_id": "q_misc",  "message": "Minor issue."}],
    "recommendations":    ["Fix the flagged items."],
    "normalized_answers": {"q_funds": 30000.0, "q_gs": "no"},
    "sources_used":       [{"source_url": "https://immi.gov.au"}],
}


def _make_mock_session():
    """Build a mock AsyncSession that captures add() calls and succeeds on commit."""
    captured = []
    session = MagicMock()
    session.add.side_effect = lambda obj: captured.append(obj)
    session.commit  = AsyncMock()
    session.refresh = AsyncMock()
    session.rollback = AsyncMock()
    session._captured = captured
    return session


def _make_mock_user():
    user = MagicMock()
    user.id = uuid.uuid4()
    return user


def _run_save(result_data=None, country="australia", visa_type="student_visa"):
    """Run save_visa_check synchronously via asyncio.run and return the VisaCheck."""
    session = _make_mock_session()
    user    = _make_mock_user()
    rd      = result_data if result_data is not None else _FULL_RESULT

    asyncio.run(save_visa_check(session, user, country, visa_type, rd))
    assert len(session._captured) == 1, "Expected exactly one VisaCheck added to session"
    return session._captured[0]


# ===========================================================================
# save_visa_check — Phase 4B fields
# ===========================================================================

class TestSaveVisaCheckPhase4BFields:
    def test_persists_high_risk_flags(self):
        check = _run_save()
        assert check.high_risk_flags == _FULL_RESULT["high_risk_flags"]

    def test_persists_soft_warnings(self):
        check = _run_save()
        assert check.soft_warnings == _FULL_RESULT["soft_warnings"]

    def test_persists_normalized_answers(self):
        check = _run_save()
        assert check.normalized_answers == _FULL_RESULT["normalized_answers"]

    def test_persists_sources_used(self):
        check = _run_save()
        assert check.sources_used == _FULL_RESULT["sources_used"]

    def test_persists_multiple_high_risk_flags(self):
        rd = dict(_FULL_RESULT, high_risk_flags=[
            {"question_id": "q1", "message": "Flag 1."},
            {"question_id": "q2", "message": "Flag 2."},
        ])
        check = _run_save(rd)
        assert len(check.high_risk_flags) == 2
        assert check.high_risk_flags[0]["question_id"] == "q1"

    def test_persists_multiple_soft_warnings(self):
        rd = dict(_FULL_RESULT, soft_warnings=[
            {"question_id": "q_gs",  "message": "GS."},
            {"question_id": "q_age", "message": "Age."},
        ])
        check = _run_save(rd)
        assert len(check.soft_warnings) == 2

    def test_high_risk_flags_defaults_to_empty_list_when_absent(self):
        """Engine result missing high_risk_flags key -> stored as []."""
        rd = {k: v for k, v in _FULL_RESULT.items() if k != "high_risk_flags"}
        check = _run_save(rd)
        assert check.high_risk_flags == []

    def test_soft_warnings_defaults_to_empty_list_when_absent(self):
        rd = {k: v for k, v in _FULL_RESULT.items() if k != "soft_warnings"}
        check = _run_save(rd)
        assert check.soft_warnings == []

    def test_normalized_answers_defaults_to_empty_dict_when_absent(self):
        rd = {k: v for k, v in _FULL_RESULT.items() if k != "normalized_answers"}
        check = _run_save(rd)
        assert check.normalized_answers == {}

    def test_sources_used_defaults_to_empty_list_when_absent(self):
        rd = {k: v for k, v in _FULL_RESULT.items() if k != "sources_used"}
        check = _run_save(rd)
        assert check.sources_used == []


class TestSaveVisaCheckPhase1FieldsPreserved:
    """Original Phase 1 fields must not be affected by Phase 4B changes."""

    def test_persists_score(self):
        check = _run_save()
        assert check.score == 80

    def test_persists_result(self):
        check = _run_save()
        assert check.result == "Moderate Risk"

    def test_persists_result_description(self):
        check = _run_save()
        assert check.result_description == "Some risk."

    def test_persists_critical_blockers(self):
        rd = dict(_FULL_RESULT, critical_blockers=[{"question_id": "q_coe", "message": "CoE."}])
        check = _run_save(rd)
        assert check.critical_blockers == [{"question_id": "q_coe", "message": "CoE."}]

    def test_persists_warnings(self):
        check = _run_save()
        assert check.warnings == _FULL_RESULT["warnings"]

    def test_persists_recommendations(self):
        check = _run_save()
        assert check.recommendations == _FULL_RESULT["recommendations"]

    def test_persists_country(self):
        check = _run_save(country="uk")
        assert check.country == "uk"

    def test_persists_visa_type(self):
        check = _run_save(visa_type="student_visa")
        assert check.visa_type == "student_visa"

    def test_persists_user_id(self):
        session = _make_mock_session()
        user    = _make_mock_user()
        asyncio.run(save_visa_check(session, user, "australia", "student_visa", _FULL_RESULT))
        check = session._captured[0]
        assert check.user_id == user.id


class TestSaveVisaCheckErrorHandling:
    def test_rollback_called_on_commit_error(self):
        session          = _make_mock_session()
        session.commit   = AsyncMock(side_effect=RuntimeError("DB down"))
        session.rollback = AsyncMock()
        user             = _make_mock_user()

        with pytest.raises(RuntimeError):
            asyncio.run(save_visa_check(session, user, "aus", "student_visa", _FULL_RESULT))

        session.rollback.assert_called_once()


# ===========================================================================
# History endpoint — Phase 4B real values
# ===========================================================================

_FAKE_USER    = AuthUser(user_id="user_4b", email="4b@example.com")
_FAKE_DB_USER = MagicMock()
_FAKE_DB_USER.id = uuid.uuid4()


def _make_router_app():
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(student_visa.router, prefix="/api/visa/student")
    app.dependency_overrides[get_current_user] = lambda: _FAKE_USER
    app.dependency_overrides[get_db] = lambda: MagicMock()
    return app


def _make_full_check():
    """VisaCheck mock with all Phase 4B fields populated."""
    check = MagicMock()
    check.id                 = uuid.uuid4()
    check.country            = "australia"
    check.visa_type          = "student_visa"
    check.score              = 80
    check.result             = "Moderate Risk"
    check.result_description = "Some risk."
    check.critical_blockers  = []
    check.high_risk_flags    = [{"question_id": "q_funds", "message": "Fund risk."}]
    check.soft_warnings      = [{"question_id": "q_gs",    "message": "GS warning."}]
    check.normalized_answers = {"q_funds": 30000.0, "q_gs": "no"}
    check.sources_used       = [{"source_url": "https://immi.gov.au"}]
    check.warnings           = [{"question_id": "q_misc",  "message": "Minor issue."}]
    check.recommendations    = ["Fix flagged items."]
    check.created_at         = datetime(2026, 6, 1, 12, 0, 0)
    return check


def _make_null_check():
    """Simulate a pre-migration row where Phase 4B columns are NULL."""
    check = _make_full_check()
    check.high_risk_flags    = None
    check.soft_warnings      = None
    check.normalized_answers = None
    check.sources_used       = None
    return check


class TestHistoryPhase4BRealValues:
    def setup_method(self):
        self.client = TestClient(_make_router_app(), raise_server_exceptions=False)

    def _get_history(self, checks):
        db_user = MagicMock()
        db_user.id = uuid.uuid4()
        with patch("routers.student_visa.get_user_by_auth_id",
                   AsyncMock(return_value=db_user)), \
             patch("routers.student_visa.get_user_checks",
                   AsyncMock(return_value=checks)):
            return self.client.get("/api/visa/student/history")

    def test_high_risk_flags_returns_persisted_value(self):
        resp = self._get_history([_make_full_check()])
        item = resp.json()[0]
        assert item["high_risk_flags"] == [{"question_id": "q_funds", "message": "Fund risk."}]

    def test_soft_warnings_returns_persisted_value(self):
        resp = self._get_history([_make_full_check()])
        item = resp.json()[0]
        assert item["soft_warnings"] == [{"question_id": "q_gs", "message": "GS warning."}]

    def test_normalized_answers_returns_persisted_value(self):
        resp = self._get_history([_make_full_check()])
        item = resp.json()[0]
        assert item["normalized_answers"] == {"q_funds": 30000.0, "q_gs": "no"}

    def test_sources_used_returns_persisted_value(self):
        resp = self._get_history([_make_full_check()])
        item = resp.json()[0]
        assert item["sources_used"] == [{"source_url": "https://immi.gov.au"}]

    def test_warnings_still_returns_persisted_value(self):
        resp = self._get_history([_make_full_check()])
        item = resp.json()[0]
        assert item["warnings"] == [{"question_id": "q_misc", "message": "Minor issue."}]

    def test_all_phase4b_fields_present_in_response(self):
        resp = self._get_history([_make_full_check()])
        item = resp.json()[0]
        for field in ("high_risk_flags", "soft_warnings",
                      "normalized_answers", "sources_used"):
            assert field in item, f"Missing field: {field}"


class TestHistoryNullSafety:
    """Pre-migration rows have NULL in the new columns. History must not crash."""

    def setup_method(self):
        self.client = TestClient(_make_router_app(), raise_server_exceptions=False)

    def _get_history_null(self):
        db_user = MagicMock()
        db_user.id = uuid.uuid4()
        with patch("routers.student_visa.get_user_by_auth_id",
                   AsyncMock(return_value=db_user)), \
             patch("routers.student_visa.get_user_checks",
                   AsyncMock(return_value=[_make_null_check()])):
            return self.client.get("/api/visa/student/history")

    def test_null_high_risk_flags_returns_empty_list(self):
        resp = self._get_history_null()
        assert resp.status_code == 200
        assert resp.json()[0]["high_risk_flags"] == []

    def test_null_soft_warnings_returns_empty_list(self):
        resp = self._get_history_null()
        assert resp.json()[0]["soft_warnings"] == []

    def test_null_normalized_answers_returns_empty_dict(self):
        resp = self._get_history_null()
        assert resp.json()[0]["normalized_answers"] == {}

    def test_null_sources_used_returns_empty_list(self):
        resp = self._get_history_null()
        assert resp.json()[0]["sources_used"] == []

    def test_null_columns_do_not_crash_history_endpoint(self):
        resp = self._get_history_null()
        assert resp.status_code == 200


# ===========================================================================
# check_readiness — full engine result passed to save_visa_check
# ===========================================================================

_CANONICAL_QUESTION = {
    "id": "aus_q1",
    "question": "Q?",
    "help_text": "H.",
    "input_type": "yes_no",
    "options": [{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}],
    "required": True,
    "scoring_key": "cat_core",
    "risk_category": "High",
    "validation": {"pass_if": {"type": "eq", "value": "yes"}},
    "show_if": None,
    "normalized_answer_format": "boolean",
    "error_message": "Must answer.",
    "blocker_possible": False,
    "source_url": "https://immi.gov.au",
    "score_impact": 10,
}

_SCORING = {
    "score_bands": [
        {"min": 85, "max": 100, "label": "Strong Readiness", "description": "Strong."},
        {"min": 0,  "max": 84,  "label": "Needs Work",       "description": "Work."},
    ],
    "scoring_categories": [],
    "critical_blockers_hard": [],
    "high_risk_flags": [],
    "soft_warnings": [],
    "config": {},
}


class TestCheckReadinessPersistsFullResult:
    def setup_method(self):
        self.client = TestClient(_make_router_app(), raise_server_exceptions=False)
        self._saved_check = MagicMock()
        self._saved_check.id = uuid.uuid4()
        self._save_calls: list = []

    def _capture_save(self, *args, **kwargs):
        self._save_calls.append((args, kwargs))
        return self._saved_check

    def _post(self, engine_result):
        with patch("routers.student_visa.load_questions",
                   return_value=[_CANONICAL_QUESTION]), \
             patch("routers.student_visa.load_scoring",
                   return_value=_SCORING), \
             patch("routers.student_visa.evaluate",
                   return_value=engine_result), \
             patch("routers.student_visa.get_user_by_auth_id",
                   AsyncMock(return_value=_FAKE_DB_USER)), \
             patch("routers.student_visa.save_visa_check",
                   AsyncMock(side_effect=self._capture_save)):
            return self.client.post(
                "/api/visa/student/australia/check",
                json={"answers": {"aus_q1": "yes"}},
            )

    def test_save_called_once(self):
        self._post(_FULL_RESULT)
        assert len(self._save_calls) == 1

    def test_save_receives_high_risk_flags(self):
        engine_result = dict(_FULL_RESULT,
                             high_risk_flags=[{"question_id": "q1", "message": "Flag."}])
        self._post(engine_result)
        _, result_arg = self._save_calls[0][0][3], self._save_calls[0][0][4]
        assert result_arg["high_risk_flags"] == [{"question_id": "q1", "message": "Flag."}]

    def test_save_receives_soft_warnings(self):
        engine_result = dict(_FULL_RESULT,
                             soft_warnings=[{"question_id": "q_gs", "message": "GS."}])
        self._post(engine_result)
        _, result_arg = self._save_calls[0][0][3], self._save_calls[0][0][4]
        assert result_arg["soft_warnings"] == [{"question_id": "q_gs", "message": "GS."}]

    def test_save_receives_normalized_answers(self):
        engine_result = dict(_FULL_RESULT, normalized_answers={"aus_q1": "yes"})
        self._post(engine_result)
        _, result_arg = self._save_calls[0][0][3], self._save_calls[0][0][4]
        assert result_arg["normalized_answers"] == {"aus_q1": "yes"}

    def test_save_receives_sources_used(self):
        engine_result = dict(_FULL_RESULT,
                             sources_used=[{"source_url": "https://immi.gov.au"}])
        self._post(engine_result)
        _, result_arg = self._save_calls[0][0][3], self._save_calls[0][0][4]
        assert result_arg["sources_used"] == [{"source_url": "https://immi.gov.au"}]
