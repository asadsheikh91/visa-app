"""
tests/test_student_visa_router.py

Phase 3 — Integration tests for routers/student_visa.py.

Uses FastAPI TestClient. All external dependencies (auth, DB, R2, Redis)
are mocked via dependency overrides and unittest.mock.patch.

Coverage:
  GET /{country}/questions
    — returns canonical field names
    — does NOT return old field names (question_id, question_text, user_help_text)
    — source_ids resolved when include_sources=true and sources.json present
    — unresolved source_id does not crash
    — non-USA country without sources.json still returns questions
    — optional files missing do not crash

  POST /{country}/check
    — returns high_risk_flags
    — returns critical_blockers
    — returns required_missing_answers
    — optional blockers/rules/sources files missing do not crash
    — returns 404 for unsupported country
    — returns 400 for empty answers

  GET /countries
    — returns list of supported countries

  GET /history
    — returns check history (high_risk_flags always [] per DB limitation)
"""

import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from auth.base import AuthUser
from auth.dependencies import get_current_user
from database import get_db
from limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from routers import student_visa


# ---------------------------------------------------------------------------
# Shared test app + client
# ---------------------------------------------------------------------------

def _make_app():
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(student_visa.router, prefix="/api/visa/student")
    return app


_FAKE_USER = AuthUser(user_id="user_clerk_001", email="test@example.com")
_FAKE_DB_USER = MagicMock()
_FAKE_DB_USER.id = uuid.uuid4()


def _override_auth():
    return _FAKE_USER


def _override_db():
    session = MagicMock()
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock(return_value=False)
    return session


def _make_client():
    app = _make_app()
    app.dependency_overrides[get_current_user] = _override_auth
    app.dependency_overrides[get_db] = _override_db
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Canonical question data
# ---------------------------------------------------------------------------

_CANONICAL_QUESTION = {
    "id": "aus_has_coe",
    "question": "Do you have a Confirmation of Enrolment?",
    "help_text": "A CoE is required from a registered provider.",
    "input_type": "yes_no",
    "options": [{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}],
    "required": True,
    "scoring_key": "cat_core",
    "risk_category": "Critical",
    "validation": {"pass_if": {"type": "eq", "value": "yes"}},
    "show_if": None,
    "normalized_answer_format": "boolean",
    "error_message": "You must have a CoE.",
    "blocker_possible": True,
    "source_url": "https://immi.homeaffairs.gov.au",
    "score_impact": 20,
}

_OLD_QUESTION = {
    "question_id": "aus_has_coe_old",
    "question_text": "Do you have a CoE?",
    "user_help_text": "Old help text.",
    "critical_blocker_if": "answer == no",
    "input_type": "yes_no",
    "options": [],
    "required": True,
}

_SCORING = {
    "score_bands": [
        {"min": 85, "max": 100, "label": "Strong Readiness",    "description": "Strong."},
        {"min": 70, "max": 84,  "label": "Moderate Risk",       "description": "Moderate."},
        {"min": 50, "max": 69,  "label": "High Refusal Risk",   "description": "High risk."},
        {"min": 0,  "max": 49,  "label": "Critical Refusal Risk","description": "Critical."},
    ],
    "scoring_categories": [],
    "critical_blockers_hard": [
        {
            "question_id": "aus_has_coe",
            "trigger_if": {"type": "eq", "value": "no"},
            "mapped_rule": "CoE Required",
            "conditional_on": None,
            "message": "You must obtain a CoE before applying.",
        }
    ],
    "high_risk_flags": [
        {
            "question_id": "aus_funds",
            "trigger_if": {"type": "eq", "value": "no"},
            "mapped_rule": "Financial Capacity",
            "conditional_on": None,
            "message": "Insufficient evidence of funds.",
        }
    ],
    "config": {},
}

_AUS_SOURCES = {
    "country": "Australia",
    "sources": {},
}

_USA_SOURCES = {
    "country": "United States",
    "sources": {
        "usa_src_state_dept": {
            "name": "US Department of State",
            "url": "https://travel.state.gov/student",
        },
    },
}


# ---------------------------------------------------------------------------
# GET /{country}/questions — canonical fields
# ---------------------------------------------------------------------------

class TestGetQuestionsCanonicalFields:
    def setup_method(self):
        self.client = _make_client()
        # get_questions preflights scoring.json for R2 connectivity; keep it happy.
        self._scoring_patch = patch("routers.student_visa.load_scoring", return_value=_SCORING)
        self._scoring_patch.start()

    def teardown_method(self):
        self._scoring_patch.stop()

    def test_returns_200_for_supported_country(self):
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]):
            resp = self.client.get("/api/visa/student/australia/questions")
        assert resp.status_code == 200

    def test_response_contains_questions_list(self):
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]):
            resp = self.client.get("/api/visa/student/australia/questions")
        data = resp.json()
        assert "questions" in data
        assert isinstance(data["questions"], list)
        assert len(data["questions"]) == 1

    def test_question_has_canonical_id_field(self):
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]):
            resp = self.client.get("/api/visa/student/australia/questions")
        q = resp.json()["questions"][0]
        assert "id" in q
        assert q["id"] == "aus_has_coe"

    def test_question_has_canonical_question_field(self):
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]):
            resp = self.client.get("/api/visa/student/australia/questions")
        q = resp.json()["questions"][0]
        assert "question" in q

    def test_question_has_canonical_help_text_field(self):
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]):
            resp = self.client.get("/api/visa/student/australia/questions")
        q = resp.json()["questions"][0]
        assert "help_text" in q

    def test_question_has_input_type(self):
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]):
            resp = self.client.get("/api/visa/student/australia/questions")
        q = resp.json()["questions"][0]
        assert "input_type" in q

    def test_question_has_blocker_possible(self):
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]):
            resp = self.client.get("/api/visa/student/australia/questions")
        q = resp.json()["questions"][0]
        assert "blocker_possible" in q

    def test_question_has_source_url(self):
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]):
            resp = self.client.get("/api/visa/student/australia/questions")
        q = resp.json()["questions"][0]
        assert "source_url" in q


class TestGetQuestionsDoesNotReturnOldFields:
    """Old field names must never appear in the API response."""

    def setup_method(self):
        self.client = _make_client()
        self._scoring_patch = patch("routers.student_visa.load_scoring", return_value=_SCORING)
        self._scoring_patch.start()

    def teardown_method(self):
        self._scoring_patch.stop()

    def test_question_id_not_in_response(self):
        raw = dict(_CANONICAL_QUESTION, question_id="old_id")
        with patch("routers.student_visa.load_questions", return_value=[raw]):
            resp = self.client.get("/api/visa/student/australia/questions")
        q = resp.json()["questions"][0]
        assert "question_id" not in q

    def test_question_text_not_in_response(self):
        raw = dict(_CANONICAL_QUESTION, question_text="Old question text?")
        with patch("routers.student_visa.load_questions", return_value=[raw]):
            resp = self.client.get("/api/visa/student/australia/questions")
        q = resp.json()["questions"][0]
        assert "question_text" not in q

    def test_user_help_text_not_in_response(self):
        raw = dict(_CANONICAL_QUESTION, user_help_text="Old help.")
        with patch("routers.student_visa.load_questions", return_value=[raw]):
            resp = self.client.get("/api/visa/student/australia/questions")
        q = resp.json()["questions"][0]
        assert "user_help_text" not in q

    def test_critical_blocker_if_not_in_response(self):
        raw = dict(_CANONICAL_QUESTION, critical_blocker_if="answer == no")
        with patch("routers.student_visa.load_questions", return_value=[raw]):
            resp = self.client.get("/api/visa/student/australia/questions")
        q = resp.json()["questions"][0]
        assert "critical_blocker_if" not in q

    def test_old_question_with_only_old_fields_remapped(self):
        """A question using only old schema names: remapped correctly, old names absent."""
        with patch("routers.student_visa.load_questions", return_value=[_OLD_QUESTION]):
            resp = self.client.get("/api/visa/student/australia/questions")
        q = resp.json()["questions"][0]
        assert "question_id" not in q
        assert "question_text" not in q
        assert "user_help_text" not in q
        assert "critical_blocker_if" not in q
        # Remapped fields must be present
        assert q.get("id") == "aus_has_coe_old"
        assert q.get("question") == "Do you have a CoE?"


# ---------------------------------------------------------------------------
# GET /{country}/questions — source resolution
# ---------------------------------------------------------------------------

class TestGetQuestionsSourceResolution:
    def setup_method(self):
        self.client = _make_client()
        self._scoring_patch = patch("routers.student_visa.load_scoring", return_value=_SCORING)
        self._scoring_patch.start()

    def teardown_method(self):
        self._scoring_patch.stop()

    def test_usa_sources_resolved_when_include_sources_true(self):
        q_with_src = dict(_CANONICAL_QUESTION, source_ids=["usa_src_state_dept"])
        with patch("routers.student_visa.load_questions", return_value=[q_with_src]), \
             patch("routers.student_visa.load_sources", return_value=_USA_SOURCES):
            resp = self.client.get("/api/visa/student/usa/questions?include_sources=true")
        q = resp.json()["questions"][0]
        assert "resolved_sources" in q
        assert q["resolved_sources"][0]["source_id"] == "usa_src_state_dept"

    def test_source_ids_preserved_after_resolution(self):
        q_with_src = dict(_CANONICAL_QUESTION, source_ids=["usa_src_state_dept"])
        with patch("routers.student_visa.load_questions", return_value=[q_with_src]), \
             patch("routers.student_visa.load_sources", return_value=_USA_SOURCES):
            resp = self.client.get("/api/visa/student/usa/questions?include_sources=true")
        q = resp.json()["questions"][0]
        assert q["source_ids"] == ["usa_src_state_dept"]

    def test_unresolved_source_id_does_not_crash(self):
        q_bad_src = dict(_CANONICAL_QUESTION, source_ids=["nonexistent_src_999"])
        with patch("routers.student_visa.load_questions", return_value=[q_bad_src]), \
             patch("routers.student_visa.load_sources", return_value=_USA_SOURCES):
            resp = self.client.get("/api/visa/student/usa/questions?include_sources=true")
        assert resp.status_code == 200
        q = resp.json()["questions"][0]
        assert "unresolved_source_ids" in q
        assert "nonexistent_src_999" in q["unresolved_source_ids"]

    def test_non_usa_country_without_sources_json_still_works(self):
        """UK/Canada/Australia have no sources.json; load_sources returns None -> no crash."""
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]), \
             patch("routers.student_visa.load_sources", return_value=None):
            resp = self.client.get("/api/visa/student/uk/questions?include_sources=true")
        assert resp.status_code == 200
        q = resp.json()["questions"][0]
        assert "resolved_sources" not in q

    def test_sources_not_loaded_when_include_sources_false(self):
        """sources.json must not be fetched when include_sources=false."""
        mock_load_sources = MagicMock(return_value=None)
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]), \
             patch("routers.student_visa.load_sources", mock_load_sources):
            resp = self.client.get("/api/visa/student/australia/questions")
        assert resp.status_code == 200
        mock_load_sources.assert_not_called()

    def test_sources_load_exception_does_not_crash_questions_endpoint(self):
        """If load_sources raises unexpectedly, questions still return."""
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]), \
             patch("routers.student_visa.load_sources", side_effect=RuntimeError("network")):
            resp = self.client.get("/api/visa/student/usa/questions?include_sources=true")
        assert resp.status_code == 200

    def test_include_rules_adds_rules_to_response(self):
        dummy_rules = [{"rule_id": "r1", "rule": "Rule text."}]
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]), \
             patch("routers.student_visa.load_rules", return_value=dummy_rules):
            resp = self.client.get("/api/visa/student/australia/questions?include_rules=true")
        assert resp.status_code == 200
        assert "rules" in resp.json()
        assert resp.json()["rules"] == dummy_rules

    def test_include_rules_missing_file_returns_empty_list(self):
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]), \
             patch("routers.student_visa.load_rules", return_value=None):
            resp = self.client.get("/api/visa/student/australia/questions?include_rules=true")
        assert resp.status_code == 200
        assert resp.json()["rules"] == []


# ---------------------------------------------------------------------------
# GET /{country}/questions — error cases
# ---------------------------------------------------------------------------

class TestGetQuestionsErrors:
    def setup_method(self):
        self.client = _make_client()

    def test_unsupported_country_returns_404(self):
        resp = self.client.get("/api/visa/student/germany/questions")
        assert resp.status_code == 404

    def test_data_not_found_returns_404(self):
        from services.visa_data_service import DataNotFoundError
        with patch("routers.student_visa.load_questions", side_effect=DataNotFoundError()):
            resp = self.client.get("/api/visa/student/australia/questions")
        assert resp.status_code == 404

    def test_storage_unavailable_returns_503(self):
        from services.visa_data_service import StorageUnavailableError
        with patch("routers.student_visa.load_questions", side_effect=StorageUnavailableError()):
            resp = self.client.get("/api/visa/student/australia/questions")
        assert resp.status_code == 503

    def test_scoring_preflight_storage_unavailable_returns_503(self):
        """
        Questions load fine (often from cache) but R2 is unreachable for scoring.
        The preflight must surface 503 BEFORE the applicant answers anything,
        rather than letting the failure appear at check time.
        """
        from services.visa_data_service import StorageUnavailableError
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]), \
             patch("routers.student_visa.load_scoring", side_effect=StorageUnavailableError()):
            resp = self.client.get("/api/visa/student/australia/questions")
        assert resp.status_code == 503

    def test_scoring_preflight_config_error_returns_503(self):
        """Missing R2 configuration also blocks the checker up front with 503."""
        from services.visa_data_service import StorageConfigError
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]), \
             patch("routers.student_visa.load_scoring", side_effect=StorageConfigError(["R2_ENDPOINT_URL"])):
            resp = self.client.get("/api/visa/student/australia/questions")
        assert resp.status_code == 503


# ---------------------------------------------------------------------------
# POST /{country}/check — engine result fields
# ---------------------------------------------------------------------------

def _make_saved_check():
    check = MagicMock()
    check.id = uuid.uuid4()
    return check


_BLOCKER_RESULT = {
    "score": 0,
    "result": "Critical Refusal Risk",
    "result_description": "Critical blocker detected.",
    "critical_blockers": [{"question_id": "aus_has_coe", "message": "You need a CoE.", "rule": "CoE Required"}],
    "high_risk_flags": [],
    "warnings": [],
    "recommendations": ["Fix the CoE blocker first."],
}

_FLAG_RESULT = {
    "score": 80,
    "result": "High Refusal Risk",
    "result_description": "High risk flag detected.",
    "critical_blockers": [],
    "high_risk_flags": [{"question_id": "aus_funds", "message": "Insufficient funds.", "rule": "Financial Capacity"}],
    "warnings": [],
    "recommendations": ["Address the high-risk flag."],
}

_CLEAN_RESULT = {
    "score": 90,
    "result": "Strong Readiness",
    "result_description": "Strong application.",
    "critical_blockers": [],
    "high_risk_flags": [],
    "warnings": [],
    "recommendations": ["Your file looks strong."],
}


class TestCheckEndpointReturnFields:
    def setup_method(self):
        self.client = _make_client()
        self._save_mock = AsyncMock(return_value=_make_saved_check())
        self._db_user_mock = AsyncMock(return_value=_FAKE_DB_USER)

    def _post(self, country, answers, engine_result):
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]), \
             patch("routers.student_visa.load_scoring", return_value=_SCORING), \
             patch("routers.student_visa.evaluate", return_value=engine_result), \
             patch("routers.student_visa.get_user_by_auth_id", self._db_user_mock), \
             patch("routers.student_visa.check_lifetime_cap", AsyncMock(return_value=(True, 0, 3))), \
             patch("routers.student_visa.complete_readiness_session", AsyncMock(return_value=None)), \
             patch("routers.student_visa.save_visa_check", self._save_mock):
            return self.client.post(f"/api/visa/student/{country}/check", json={"answers": answers})

    def test_check_returns_200(self):
        resp = self._post("australia", {"aus_has_coe": "yes"}, _CLEAN_RESULT)
        assert resp.status_code == 200

    def test_check_returns_score(self):
        resp = self._post("australia", {"aus_has_coe": "yes"}, _CLEAN_RESULT)
        assert "score" in resp.json()
        assert resp.json()["score"] == 90

    def test_check_returns_result(self):
        resp = self._post("australia", {"aus_has_coe": "yes"}, _CLEAN_RESULT)
        assert "result" in resp.json()

    def test_check_returns_result_description(self):
        resp = self._post("australia", {"aus_has_coe": "yes"}, _CLEAN_RESULT)
        assert "result_description" in resp.json()

    def test_check_returns_critical_blockers_list(self):
        resp = self._post("australia", {"aus_has_coe": "no"}, _BLOCKER_RESULT)
        data = resp.json()
        assert "critical_blockers" in data
        assert isinstance(data["critical_blockers"], list)

    def test_check_returns_critical_blocker_when_triggered(self):
        resp = self._post("australia", {"aus_has_coe": "no"}, _BLOCKER_RESULT)
        blockers = resp.json()["critical_blockers"]
        assert len(blockers) == 1
        assert blockers[0]["question_id"] == "aus_has_coe"

    def test_check_returns_empty_critical_blockers_when_none(self):
        resp = self._post("australia", {"aus_has_coe": "yes"}, _CLEAN_RESULT)
        assert resp.json()["critical_blockers"] == []

    def test_check_returns_high_risk_flags_list(self):
        resp = self._post("australia", {"aus_has_coe": "yes", "aus_funds": "no"}, _FLAG_RESULT)
        data = resp.json()
        assert "high_risk_flags" in data
        assert isinstance(data["high_risk_flags"], list)

    def test_check_returns_high_risk_flag_when_triggered(self):
        resp = self._post("australia", {"aus_has_coe": "yes", "aus_funds": "no"}, _FLAG_RESULT)
        flags = resp.json()["high_risk_flags"]
        assert len(flags) == 1
        assert flags[0]["question_id"] == "aus_funds"

    def test_check_returns_empty_high_risk_flags_when_none(self):
        resp = self._post("australia", {"aus_has_coe": "yes"}, _CLEAN_RESULT)
        assert resp.json()["high_risk_flags"] == []

    def test_check_returns_warnings(self):
        resp = self._post("australia", {"aus_has_coe": "yes"}, _CLEAN_RESULT)
        assert "warnings" in resp.json()

    def test_check_returns_recommendations(self):
        resp = self._post("australia", {"aus_has_coe": "yes"}, _CLEAN_RESULT)
        assert "recommendations" in resp.json()

    def test_check_returns_required_missing_answers(self):
        # Pass a dummy answer for a different key so the route doesn't 400.
        # aus_has_coe is left unanswered — it must appear in required_missing_answers.
        resp = self._post("australia", {"other_q": "yes"}, _CLEAN_RESULT)
        data = resp.json()
        assert "required_missing_answers" in data
        assert isinstance(data["required_missing_answers"], list)

    def test_required_missing_answers_includes_unanswered_required(self):
        # Pass a dummy answer so the route proceeds; aus_has_coe remains unanswered.
        resp = self._post("australia", {"other_q": "yes"}, _CLEAN_RESULT)
        # aus_has_coe is required=True in _CANONICAL_QUESTION, not answered
        assert "aus_has_coe" in resp.json()["required_missing_answers"]

    def test_required_missing_answers_excludes_answered(self):
        resp = self._post("australia", {"aus_has_coe": "yes"}, _CLEAN_RESULT)
        assert "aus_has_coe" not in resp.json()["required_missing_answers"]

    def test_check_returns_id(self):
        resp = self._post("australia", {"aus_has_coe": "yes"}, _CLEAN_RESULT)
        assert "id" in resp.json()

    def test_check_returns_visa_type(self):
        resp = self._post("australia", {"aus_has_coe": "yes"}, _CLEAN_RESULT)
        assert resp.json()["visa_type"] == "student_visa"

    def test_check_returns_country(self):
        resp = self._post("australia", {"aus_has_coe": "yes"}, _CLEAN_RESULT)
        assert resp.json()["country"] == "australia"


class TestCheckEndpointRobustness:
    def setup_method(self):
        self.client = _make_client()
        self._save_mock = AsyncMock(return_value=_make_saved_check())
        self._db_user_mock = AsyncMock(return_value=_FAKE_DB_USER)

    def _post(self, country, answers, engine_result=None):
        er = engine_result or _CLEAN_RESULT
        with patch("routers.student_visa.load_questions", return_value=[_CANONICAL_QUESTION]), \
             patch("routers.student_visa.load_scoring", return_value=_SCORING), \
             patch("routers.student_visa.evaluate", return_value=er), \
             patch("routers.student_visa.get_user_by_auth_id", self._db_user_mock), \
             patch("routers.student_visa.check_lifetime_cap", AsyncMock(return_value=(True, 0, 3))), \
             patch("routers.student_visa.complete_readiness_session", AsyncMock(return_value=None)), \
             patch("routers.student_visa.save_visa_check", self._save_mock):
            return self.client.post(f"/api/visa/student/{country}/check", json={"answers": answers})

    def test_unsupported_country_returns_404(self):
        resp = self.client.post(
            "/api/visa/student/germany/check",
            json={"answers": {"q1": "yes"}},
        )
        assert resp.status_code == 404

    def test_empty_answers_returns_400(self):
        resp = self.client.post(
            "/api/visa/student/australia/check",
            json={"answers": {}},
        )
        assert resp.status_code == 400

    def test_missing_answers_field_returns_422(self):
        resp = self.client.post("/api/visa/student/australia/check", json={})
        assert resp.status_code == 422

    def test_check_does_not_crash_when_engine_returns_no_high_risk_flags(self):
        result = dict(_CLEAN_RESULT)
        result.pop("high_risk_flags", None)  # engine omits key
        resp = self._post("australia", {"aus_has_coe": "yes"}, result)
        assert resp.status_code == 200
        assert resp.json()["high_risk_flags"] == []  # defaults to empty list

    def test_data_not_found_returns_404(self):
        from services.visa_data_service import DataNotFoundError
        with patch("routers.student_visa.load_questions", side_effect=DataNotFoundError()), \
             patch("routers.student_visa.load_scoring", side_effect=DataNotFoundError()):
            resp = self.client.post(
                "/api/visa/student/australia/check",
                json={"answers": {"aus_has_coe": "yes"}},
            )
        assert resp.status_code == 404

    def test_storage_unavailable_returns_503(self):
        from services.visa_data_service import StorageUnavailableError
        with patch("routers.student_visa.load_questions", side_effect=StorageUnavailableError()), \
             patch("routers.student_visa.load_scoring", side_effect=StorageUnavailableError()):
            resp = self.client.post(
                "/api/visa/student/australia/check",
                json={"answers": {"aus_has_coe": "yes"}},
            )
        assert resp.status_code == 503

    def test_check_works_for_all_supported_countries(self):
        for country in ["australia", "uk", "usa", "canada"]:
            resp = self._post(country, {"q1": "yes"})
            assert resp.status_code == 200, f"Failed for {country}: {resp.text}"


# ---------------------------------------------------------------------------
# GET /countries
# ---------------------------------------------------------------------------

class TestGetCountries:
    def setup_method(self):
        self.client = _make_client()

    def test_returns_200(self):
        resp = self.client.get("/api/visa/student/countries")
        assert resp.status_code == 200

    def test_returns_list(self):
        resp = self.client.get("/api/visa/student/countries")
        assert isinstance(resp.json(), list)

    def test_all_four_countries_present(self):
        resp = self.client.get("/api/visa/student/countries")
        slugs = [c["slug"] for c in resp.json()]
        assert "australia" in slugs
        assert "uk" in slugs
        assert "usa" in slugs
        assert "canada" in slugs

    def test_each_country_has_required_fields(self):
        resp = self.client.get("/api/visa/student/countries")
        for c in resp.json():
            assert "slug" in c
            assert "country" in c
            assert "visa_route" in c


# ---------------------------------------------------------------------------
# GET /history
# ---------------------------------------------------------------------------

class TestGetHistory:
    def setup_method(self):
        self.client = _make_client()

    def _fake_check(self, country="australia"):
        check = MagicMock()
        check.id = uuid.uuid4()
        check.country = country
        check.visa_type = "student_visa"
        check.score = 75
        check.result = "Moderate Risk"
        check.result_description = "Moderate risk."
        check.critical_blockers = []
        check.high_risk_flags = [{"question_id": "q_funds", "message": "Fund risk."}]
        check.soft_warnings = [{"question_id": "q_gs", "message": "GS warning."}]
        check.normalized_answers = {"q1": "yes", "q_funds": 30000.0}
        check.sources_used = [{"source_url": "https://immi.gov.au"}]
        check.warnings = [{"question_id": "q1", "message": "Improve this."}]
        check.recommendations = ["Work on the flagged items."]
        check.created_at = datetime(2026, 6, 1, 12, 0, 0)
        return check

    def test_returns_200_with_empty_history(self):
        with patch("routers.student_visa.get_user_by_auth_id", AsyncMock(return_value=None)):
            resp = self.client.get("/api/visa/student/history")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_check_list(self):
        db_user = MagicMock()
        db_user.id = uuid.uuid4()
        checks = [self._fake_check()]
        with patch("routers.student_visa.get_user_by_auth_id", AsyncMock(return_value=db_user)), \
             patch("routers.student_visa.get_user_checks", AsyncMock(return_value=checks)):
            resp = self.client.get("/api/visa/student/history")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_history_item_fields_present(self):
        db_user = MagicMock()
        db_user.id = uuid.uuid4()
        checks = [self._fake_check()]
        with patch("routers.student_visa.get_user_by_auth_id", AsyncMock(return_value=db_user)), \
             patch("routers.student_visa.get_user_checks", AsyncMock(return_value=checks)):
            resp = self.client.get("/api/visa/student/history")
        item = resp.json()[0]
        for field in ("id", "country", "visa_type", "score", "result",
                      "critical_blockers", "high_risk_flags", "warnings",
                      "recommendations", "created_at"):
            assert field in item, f"Missing field: {field}"

    def test_history_high_risk_flags_returns_persisted_value(self):
        """
        Phase 4B: high_risk_flags is now persisted and returned from history.
        """
        db_user = MagicMock()
        db_user.id = uuid.uuid4()
        checks = [self._fake_check()]
        with patch("routers.student_visa.get_user_by_auth_id", AsyncMock(return_value=db_user)), \
             patch("routers.student_visa.get_user_checks", AsyncMock(return_value=checks)):
            resp = self.client.get("/api/visa/student/history")
        item = resp.json()[0]
        assert item["high_risk_flags"] == [{"question_id": "q_funds", "message": "Fund risk."}]

    def test_history_warnings_contains_engine_warnings(self):
        db_user = MagicMock()
        db_user.id = uuid.uuid4()
        checks = [self._fake_check()]
        with patch("routers.student_visa.get_user_by_auth_id", AsyncMock(return_value=db_user)), \
             patch("routers.student_visa.get_user_checks", AsyncMock(return_value=checks)):
            resp = self.client.get("/api/visa/student/history")
        item = resp.json()[0]
        assert len(item["warnings"]) == 1
        assert item["warnings"][0]["question_id"] == "q1"
