"""
tests/test_phase4a_engine.py

Phase 4A — Tests for:
  - soft_warnings evaluation (trigger_if eq/in, conditional_on, no-fire)
  - normalize_answer / normalize_answers per input_type
  - _collect_sources_used deduplication
  - evaluate() returns soft_warnings, normalized_answers, sources_used
  - router check endpoint returns all Phase 4A fields
  - backward-compatibility: warnings field still returned

No I/O, no R2, no Redis, no real DB.
"""

import uuid
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from services.readiness_engine import (
    evaluate,
    normalize_answer,
    normalize_answers,
    _collect_sources_used,
    _evaluate_soft_warnings,
    _enrich_issue,
)

from auth.base import AuthUser
from auth.dependencies import get_current_user
from database import get_db
from limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from routers import student_visa


# ===========================================================================
# Shared fixtures / helpers
# ===========================================================================

BANDS = [
    {"min": 85, "max": 100, "label": "Strong Readiness",    "description": "Strong file."},
    {"min": 70, "max": 84,  "label": "Moderate Risk",       "description": "Moderate risk."},
    {"min": 50, "max": 69,  "label": "High Refusal Risk",   "description": "High risk."},
    {"min": 0,  "max": 49,  "label": "Critical Refusal Risk","description": "Critical."},
]


def _make_scoring(blockers=None, flags=None, soft_warnings=None,
                  config=None, categories=None):
    return {
        "score_bands":          BANDS,
        "scoring_categories":   categories or [],
        "critical_blockers_hard": blockers or [],
        "high_risk_flags":      flags or [],
        "soft_warnings":        soft_warnings or [],
        "config":               config or {},
    }


def _make_question(qid, pass_if_type="eq", pass_if_value="yes",
                   input_type="yes_no", required=True,
                   risk="High", help_text="Fix this.", score_impact=5,
                   source_url="https://example.com", source_ids=None):
    q = {
        "id": qid,
        "question": "Some question?",
        "help_text": help_text,
        "input_type": input_type,
        "required": required,
        "risk_category": risk,
        "mapped_rule": "Some rule",
        "mapped_rule_id": qid + "_rule",
        "source_url": source_url,
        "score_impact": score_impact,
        "validation": {
            "pass_if":    {"type": pass_if_type, "value": pass_if_value},
            "trigger_if": {"type": "eq", "value": "no"},
        },
    }
    if source_ids:
        q["source_ids"] = source_ids
    return q


def _make_soft_warning(qid, trigger_type="eq", trigger_value="no",
                       conditional_on=None, message="Watch out.",
                       mapped_rule_id=None):
    sw = {
        "question_id": qid,
        "trigger_if": {"type": trigger_type, "value": trigger_value},
        "mapped_rule": "A rule",
        "conditional_on": conditional_on,
        "message": message,
    }
    if mapped_rule_id:
        sw["mapped_rule_id"] = mapped_rule_id
    return sw


# ===========================================================================
# _evaluate_soft_warnings
# ===========================================================================

class TestSoftWarningsEq:
    def test_eq_trigger_fires(self):
        sw    = [_make_soft_warning("q1", "eq", "no")]
        qmap  = {"q1": _make_question("q1")}
        result = _evaluate_soft_warnings(sw, {"q1": "no"}, qmap, {})
        assert len(result) == 1
        assert result[0]["question_id"] == "q1"

    def test_eq_trigger_does_not_fire_when_unmatched(self):
        sw    = [_make_soft_warning("q1", "eq", "no")]
        qmap  = {"q1": _make_question("q1")}
        result = _evaluate_soft_warnings(sw, {"q1": "yes"}, qmap, {})
        assert result == []

    def test_eq_case_insensitive(self):
        sw    = [_make_soft_warning("q1", "eq", "no")]
        qmap  = {"q1": _make_question("q1")}
        result = _evaluate_soft_warnings(sw, {"q1": "NO"}, qmap, {})
        assert len(result) == 1

    def test_eq_does_not_fire_when_answer_absent(self):
        sw    = [_make_soft_warning("q1", "eq", "no")]
        qmap  = {"q1": _make_question("q1")}
        result = _evaluate_soft_warnings(sw, {}, qmap, {})
        assert result == []


class TestSoftWarningsIn:
    def test_in_fires_on_listed_value(self):
        sw   = [_make_soft_warning("q1", "in", ["no", "unknown"])]
        qmap = {"q1": _make_question("q1")}
        result = _evaluate_soft_warnings(sw, {"q1": "no"}, qmap, {})
        assert len(result) == 1

    def test_in_fires_on_second_listed_value(self):
        sw   = [_make_soft_warning("q1", "in", ["no", "unknown"])]
        qmap = {"q1": _make_question("q1")}
        result = _evaluate_soft_warnings(sw, {"q1": "unknown"}, qmap, {})
        assert len(result) == 1

    def test_in_does_not_fire_on_unlisted_value(self):
        sw   = [_make_soft_warning("q1", "in", ["no", "unknown"])]
        qmap = {"q1": _make_question("q1")}
        result = _evaluate_soft_warnings(sw, {"q1": "yes"}, qmap, {})
        assert result == []


class TestSoftWarningsConditionalOn:
    def test_conditional_on_skips_when_not_met(self):
        sw = [_make_soft_warning(
            "q_child", "eq", "no",
            conditional_on={"question_id": "q_parent", "operator": "eq", "value": "yes"},
        )]
        qmap = {"q_child": _make_question("q_child"), "q_parent": _make_question("q_parent")}
        # q_parent=no -> conditional not met -> soft warning skipped
        result = _evaluate_soft_warnings(sw, {"q_child": "no", "q_parent": "no"}, qmap, {})
        assert result == []

    def test_conditional_on_fires_when_met(self):
        sw = [_make_soft_warning(
            "q_child", "eq", "no",
            conditional_on={"question_id": "q_parent", "operator": "eq", "value": "yes"},
        )]
        qmap = {"q_child": _make_question("q_child"), "q_parent": _make_question("q_parent")}
        result = _evaluate_soft_warnings(sw, {"q_child": "no", "q_parent": "yes"}, qmap, {})
        assert len(result) == 1

    def test_none_conditional_always_evaluates(self):
        sw   = [_make_soft_warning("q1", "eq", "no", conditional_on=None)]
        qmap = {"q1": _make_question("q1")}
        result = _evaluate_soft_warnings(sw, {"q1": "no"}, qmap, {})
        assert len(result) == 1


class TestSoftWarningsRobustness:
    def test_malformed_non_dict_entry_skipped(self):
        sw   = ["not_a_dict", _make_soft_warning("q1", "eq", "no")]
        qmap = {"q1": _make_question("q1")}
        result = _evaluate_soft_warnings(sw, {"q1": "no"}, qmap, {})
        assert len(result) == 1  # only the valid one fires

    def test_missing_question_id_skipped(self):
        sw   = [{"trigger_if": {"type": "eq", "value": "no"}, "message": "Oops"}]
        qmap = {}
        result = _evaluate_soft_warnings(sw, {"q1": "no"}, qmap, {})
        assert result == []

    def test_multiple_soft_warnings_all_triggered(self):
        sw = [
            _make_soft_warning("q1", "eq", "no"),
            _make_soft_warning("q2", "eq", "no"),
        ]
        qmap = {"q1": _make_question("q1"), "q2": _make_question("q2")}
        result = _evaluate_soft_warnings(sw, {"q1": "no", "q2": "no"}, qmap, {})
        assert len(result) == 2

    def test_mapped_rule_id_from_soft_warning_included(self):
        sw   = [_make_soft_warning("q1", "eq", "no", mapped_rule_id="sw_rule_001")]
        qmap = {"q1": _make_question("q1")}
        result = _evaluate_soft_warnings(sw, {"q1": "no"}, qmap, {})
        assert result[0]["rule_id"] == "sw_rule_001"

    def test_lt_trigger_fires_for_numeric(self):
        """Numeric comparisons (lt/gte) work for soft_warnings too."""
        sw   = [{"question_id": "q_age", "trigger_if": {"type": "lt", "value": 6},
                 "mapped_rule": "Age check", "conditional_on": None, "message": "Under 6."}]
        qmap = {"q_age": _make_question("q_age", input_type="number")}
        result = _evaluate_soft_warnings(sw, {"q_age": "5"}, qmap, {})
        assert len(result) == 1

    def test_lt_trigger_does_not_fire_above_threshold(self):
        sw   = [{"question_id": "q_age", "trigger_if": {"type": "lt", "value": 6},
                 "mapped_rule": "Age check", "conditional_on": None, "message": "Under 6."}]
        qmap = {"q_age": _make_question("q_age", input_type="number")}
        result = _evaluate_soft_warnings(sw, {"q_age": "10"}, qmap, {})
        assert result == []


# ===========================================================================
# evaluate() — soft_warnings and backward-compat warnings
# ===========================================================================

class TestEvaluateSoftWarnings:
    def test_soft_warnings_returned_in_result(self):
        scoring = _make_scoring(soft_warnings=[_make_soft_warning("q1", "eq", "no")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert "soft_warnings" in result
        assert len(result["soft_warnings"]) == 1
        assert result["soft_warnings"][0]["question_id"] == "q1"

    def test_soft_warnings_empty_when_not_triggered(self):
        scoring = _make_scoring(soft_warnings=[_make_soft_warning("q1", "eq", "no")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "yes"})
        assert result["soft_warnings"] == []

    def test_soft_warnings_empty_when_no_definitions(self):
        scoring = _make_scoring()
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert result["soft_warnings"] == []

    def test_warnings_backward_compat_field_always_returned(self):
        """The original auto-computed 'warnings' field must still be in the result."""
        scoring = _make_scoring()
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert "warnings" in result

    def test_soft_warnings_not_returned_when_blocker_fires(self):
        """When a critical blocker fires, soft_warnings are [] (early return path)."""
        blocker = {"question_id": "q1",
                   "trigger_if": {"type": "eq", "value": "no"},
                   "mapped_rule": "Hard stop", "conditional_on": None,
                   "message": "Must fix."}
        sw = _make_soft_warning("q2", "eq", "no")
        scoring = _make_scoring(blockers=[blocker], soft_warnings=[sw])
        qs = [_make_question("q1"), _make_question("q2")]
        result = evaluate(qs, scoring, {"q1": "no", "q2": "no"})
        assert len(result["critical_blockers"]) == 1
        assert result["soft_warnings"] == []


# ===========================================================================
# normalize_answer
# ===========================================================================

class TestNormalizeAnswerYesNo:
    def test_yes_lowercased(self):
        assert normalize_answer("YES", "yes_no") == "yes"

    def test_no_lowercased(self):
        assert normalize_answer("No", "yes_no") == "no"

    def test_yes_no_unknown_yes(self):
        assert normalize_answer("YES", "yes_no_unknown") == "yes"

    def test_yes_no_unknown_unknown(self):
        assert normalize_answer("Unknown", "yes_no_unknown") == "unknown"


class TestNormalizeAnswerSingleChoice:
    def test_stripped(self):
        assert normalize_answer("  ontario  ", "single_choice") == "ontario"

    def test_value_unchanged_otherwise(self):
        assert normalize_answer("london", "single_choice") == "london"


class TestNormalizeAnswerMultiChoice:
    def test_list_returned_for_list_input(self):
        result = normalize_answer(["family_ties", "savings"], "multi_choice")
        assert result == ["family_ties", "savings"]

    def test_comma_string_split_to_list(self):
        result = normalize_answer("family_ties,savings", "multi_choice")
        assert result == ["family_ties", "savings"]

    def test_single_string_returned_as_single_item_list(self):
        result = normalize_answer("family_ties", "multi_choice")
        assert result == ["family_ties"]

    def test_empty_string_returns_empty_list(self):
        result = normalize_answer("", "multi_choice")
        assert result == []

    def test_list_items_stripped(self):
        result = normalize_answer(["  yes  ", "  no  "], "multi_choice")
        assert result == ["yes", "no"]


class TestNormalizeAnswerCurrency:
    def test_numeric_string_returns_float(self):
        assert normalize_answer("50000", "currency_amount") == 50000.0

    def test_comma_separated_returns_float(self):
        assert normalize_answer("50,000", "currency_amount") == 50000.0

    def test_non_numeric_returned_as_is(self):
        result = normalize_answer("pending", "currency_amount")
        assert result == "pending"

    def test_integer_returned_as_float(self):
        assert normalize_answer(1000, "currency_amount") == 1000.0


class TestNormalizeAnswerNumber:
    def test_string_number_returned_as_float(self):
        assert normalize_answer("3", "number") == 3.0

    def test_non_numeric_returned_as_is(self):
        assert normalize_answer("many", "number") == "many"


class TestNormalizeAnswerDate:
    def test_already_iso_format_unchanged(self):
        assert normalize_answer("2025-09-01", "date") == "2025-09-01"

    def test_dd_mm_yyyy_converted(self):
        assert normalize_answer("15/08/2025", "date") == "2025-08-15"

    def test_unparseable_returned_as_is(self):
        result = normalize_answer("not-a-date", "date")
        assert result == "not-a-date"


class TestNormalizeAnswerText:
    def test_trimmed(self):
        assert normalize_answer("  hello world  ", "text") == "hello world"

    def test_empty_string(self):
        assert normalize_answer("", "text") == ""


class TestNormalizeAnswerNone:
    def test_none_returns_none_for_all_types(self):
        for t in ("yes_no", "currency_amount", "multi_choice", "date", "text"):
            assert normalize_answer(None, t) is None


class TestNormalizeAnswersDict:
    def test_returns_new_dict_not_mutating_original(self):
        qs = [_make_question("q1", input_type="yes_no")]
        answers = {"q1": "YES"}
        result = normalize_answers(qs, answers)
        assert answers["q1"] == "YES"  # original unchanged
        assert result["q1"] == "yes"

    def test_currency_normalized_to_float(self):
        qs = [_make_question("q1", input_type="currency_amount")]
        result = normalize_answers(qs, {"q1": "30,000"})
        assert result["q1"] == 30000.0

    def test_multi_choice_list_preserved(self):
        qs = [_make_question("q1", input_type="multi_choice")]
        result = normalize_answers(qs, {"q1": ["a", "b"]})
        assert result["q1"] == ["a", "b"]

    def test_text_trimmed(self):
        qs = [_make_question("q1", input_type="text")]
        result = normalize_answers(qs, {"q1": "  trimmed  "})
        assert result["q1"] == "trimmed"

    def test_unknown_question_id_treated_as_text(self):
        qs = []  # no question definitions
        result = normalize_answers(qs, {"mystery_q": "  value  "})
        assert result["mystery_q"] == "value"

    def test_none_answer_omitted_from_output(self):
        qs = [_make_question("q1", input_type="yes_no")]
        result = normalize_answers(qs, {"q1": None})
        assert "q1" not in result

    def test_all_input_types_handled_without_crash(self):
        types = ["yes_no", "yes_no_unknown", "single_choice", "multi_choice",
                 "currency_amount", "number", "date", "text"]
        qs = [_make_question(f"q_{t}", input_type=t) for t in types]
        answers = {f"q_{t}": "yes" for t in types}
        result = normalize_answers(qs, answers)
        assert len(result) == len(types)


class TestNormalizeAnswersInEvaluate:
    def test_normalized_answers_returned_by_evaluate(self):
        scoring = _make_scoring()
        qs = [_make_question("q1", input_type="yes_no")]
        result = evaluate(qs, scoring, {"q1": "YES"})
        assert "normalized_answers" in result
        assert result["normalized_answers"]["q1"] == "yes"

    def test_normalized_answers_currency_float(self):
        scoring = _make_scoring()
        qs = [_make_question("q_funds", input_type="currency_amount")]
        result = evaluate(qs, scoring, {"q_funds": "50,000"})
        assert result["normalized_answers"]["q_funds"] == 50000.0

    def test_normalized_answers_in_blocker_early_return(self):
        """normalize_answers must also be present when a blocker fires."""
        blocker = {"question_id": "q1", "trigger_if": {"type": "eq", "value": "no"},
                   "mapped_rule": "Rule", "conditional_on": None, "message": "Stop."}
        scoring = _make_scoring(blockers=[blocker])
        qs = [_make_question("q1", input_type="yes_no")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert "normalized_answers" in result
        assert result["normalized_answers"]["q1"] == "no"


# ===========================================================================
# _collect_sources_used
# ===========================================================================

class TestCollectSourcesUsed:
    def test_single_source_url_collected(self):
        issues = [{"source_url": "https://example.com", "question_id": "q1"}]
        result = _collect_sources_used(issues, {})
        assert len(result) == 1
        assert result[0]["source_url"] == "https://example.com"

    def test_duplicate_source_url_deduplicated(self):
        issues = [
            {"source_url": "https://example.com"},
            {"source_url": "https://example.com"},
        ]
        result = _collect_sources_used(issues, {})
        assert len(result) == 1

    def test_multiple_distinct_urls_all_included(self):
        issues = [
            {"source_url": "https://a.com"},
            {"source_url": "https://b.com"},
        ]
        result = _collect_sources_used(issues, {})
        assert len(result) == 2

    def test_source_ids_included_when_present(self):
        issues = [{"source_url": "https://a.com", "source_ids": ["src_001"]}]
        result = _collect_sources_used(issues, {})
        assert result[0]["source_ids"] == ["src_001"]

    def test_source_ids_without_url_included(self):
        issues = [{"source_ids": ["src_no_url"]}]
        result = _collect_sources_used(issues, {})
        assert len(result) == 1
        assert result[0]["source_ids"] == ["src_no_url"]

    def test_source_ids_without_url_deduplicated(self):
        issues = [
            {"source_ids": ["src_001"]},
            {"source_ids": ["src_001"]},
        ]
        result = _collect_sources_used(issues, {})
        assert len(result) == 1

    def test_issue_with_neither_url_nor_ids_not_included(self):
        issues = [{"question_id": "q1", "message": "No sources here"}]
        result = _collect_sources_used(issues, {})
        assert result == []

    def test_empty_issues_returns_empty(self):
        assert _collect_sources_used([], {}) == []


class TestSourcesUsedInEvaluate:
    def test_sources_used_returned_by_evaluate(self):
        scoring = _make_scoring(
            flags=[{"question_id": "q1",
                    "trigger_if": {"type": "eq", "value": "no"},
                    "mapped_rule": "R", "conditional_on": None, "message": "M"}]
        )
        qs = [_make_question("q1", source_url="https://example.com")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert "sources_used" in result
        assert any(s.get("source_url") == "https://example.com"
                   for s in result["sources_used"])

    def test_sources_used_deduplicated_across_flag_and_warning(self):
        """Two triggered issues sharing a source_url -> only one source entry."""
        scoring = _make_scoring(
            flags=[{"question_id": "q1",
                    "trigger_if": {"type": "eq", "value": "no"},
                    "mapped_rule": "R1", "conditional_on": None, "message": "M1"}],
            soft_warnings=[{"question_id": "q2",
                             "trigger_if": {"type": "eq", "value": "no"},
                             "mapped_rule": "R2", "conditional_on": None, "message": "M2"}],
        )
        qs = [
            _make_question("q1", source_url="https://shared.com"),
            _make_question("q2", source_url="https://shared.com"),
        ]
        result = evaluate(qs, scoring, {"q1": "no", "q2": "no"})
        urls = [s.get("source_url") for s in result["sources_used"]]
        assert urls.count("https://shared.com") == 1

    def test_sources_used_empty_when_no_issues_triggered(self):
        scoring = _make_scoring()
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "yes"})
        assert result["sources_used"] == []

    def test_sources_used_includes_source_ids(self):
        scoring = _make_scoring(
            soft_warnings=[_make_soft_warning("q1", "eq", "no")]
        )
        qs = [_make_question("q1", source_url="https://example.com",
                             source_ids=["src_001"])]
        result = evaluate(qs, scoring, {"q1": "no"})
        src = result["sources_used"][0]
        assert src.get("source_ids") == ["src_001"]

    def test_sources_used_present_in_blocker_early_return(self):
        blocker = {"question_id": "q1", "trigger_if": {"type": "eq", "value": "no"},
                   "mapped_rule": "R", "conditional_on": None, "message": "M"}
        scoring = _make_scoring(blockers=[blocker])
        qs = [_make_question("q1", source_url="https://blocker.com")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert any(s.get("source_url") == "https://blocker.com"
                   for s in result["sources_used"])


# ===========================================================================
# Router — check endpoint Phase 4A fields
# ===========================================================================

_FAKE_USER    = AuthUser(user_id="user_test_4a", email="test4a@example.com")
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

_ENGINE_RESULT_4A = {
    "score": 75,
    "result": "Moderate Risk",
    "result_description": "Some risk.",
    "critical_blockers": [],
    "high_risk_flags": [],
    "soft_warnings": [{"question_id": "aus_q1", "message": "Watch out.", "rule": "R"}],
    "warnings": [],
    "recommendations": ["Work on items."],
    "normalized_answers": {"aus_q1": "no"},
    "sources_used": [{"source_url": "https://immi.gov.au"}],
}

_SCORING = {
    "score_bands": BANDS,
    "scoring_categories": [],
    "critical_blockers_hard": [],
    "high_risk_flags": [],
    "soft_warnings": [],
    "config": {},
}


class TestRouterPhase4AFields:
    def setup_method(self):
        self.client = TestClient(_make_router_app(), raise_server_exceptions=False)
        self._saved = MagicMock()
        self._saved.id = uuid.uuid4()

    def _post(self, answers=None, engine_result=None):
        er = engine_result or _ENGINE_RESULT_4A
        with patch("routers.student_visa.load_questions",
                   return_value=[_CANONICAL_QUESTION]), \
             patch("routers.student_visa.load_scoring",
                   return_value=_SCORING), \
             patch("routers.student_visa.evaluate", return_value=er), \
             patch("routers.student_visa.get_user_by_auth_id",
                   AsyncMock(return_value=_FAKE_DB_USER)), \
             patch("routers.student_visa.save_visa_check",
                   AsyncMock(return_value=self._saved)):
            return self.client.post(
                "/api/visa/student/australia/check",
                json={"answers": answers or {"aus_q1": "no"}},
            )

    def test_response_200(self):
        assert self._post().status_code == 200

    def test_soft_warnings_in_response(self):
        data = self._post().json()
        assert "soft_warnings" in data
        assert isinstance(data["soft_warnings"], list)

    def test_soft_warnings_content_correct(self):
        data = self._post().json()
        assert data["soft_warnings"][0]["question_id"] == "aus_q1"

    def test_normalized_answers_in_response(self):
        data = self._post().json()
        assert "normalized_answers" in data
        assert isinstance(data["normalized_answers"], dict)

    def test_normalized_answers_content_correct(self):
        data = self._post().json()
        assert data["normalized_answers"]["aus_q1"] == "no"

    def test_sources_used_in_response(self):
        data = self._post().json()
        assert "sources_used" in data
        assert isinstance(data["sources_used"], list)

    def test_sources_used_content_correct(self):
        data = self._post().json()
        assert data["sources_used"][0]["source_url"] == "https://immi.gov.au"

    def test_warnings_backward_compat_field_in_response(self):
        """The original 'warnings' field must still be present."""
        data = self._post().json()
        assert "warnings" in data

    def test_soft_warnings_empty_list_when_engine_omits_key(self):
        """If old engine doesn't return soft_warnings, default to []."""
        result = dict(_ENGINE_RESULT_4A)
        result.pop("soft_warnings")
        data = self._post(engine_result=result).json()
        assert data["soft_warnings"] == []

    def test_normalized_answers_empty_dict_when_engine_omits_key(self):
        result = dict(_ENGINE_RESULT_4A)
        result.pop("normalized_answers")
        data = self._post(engine_result=result).json()
        assert data["normalized_answers"] == {}

    def test_sources_used_empty_list_when_engine_omits_key(self):
        result = dict(_ENGINE_RESULT_4A)
        result.pop("sources_used")
        data = self._post(engine_result=result).json()
        assert data["sources_used"] == []

    def test_all_original_fields_still_present(self):
        data = self._post().json()
        for field in ("id", "visa_type", "country", "score", "result",
                      "result_description", "critical_blockers", "high_risk_flags",
                      "warnings", "recommendations", "required_missing_answers"):
            assert field in data, f"Missing original field: {field}"
