"""
tests/test_visa_data_service.py

Phase 3 — Unit tests for visa_data_service.py.

No I/O, no R2, no Redis. All network/cache calls are mocked.

Coverage:
  normalize_question        — canonical fields returned, old fields stripped, remaps applied
  normalize_questions       — list handling, non-dict entries dropped
  resolve_sources           — USA source_ids resolved, unresolved handled, None sources safe
  compute_required_missing  — required visible missing, hidden show_if excluded
  _evaluate_show_if         — eq/neq/in/not_in/multi_contains/and/or
  load_* functions          — R2 fetch + Redis cache behaviour (mocked)
"""

import json
import pytest
from unittest.mock import MagicMock, patch, call

from services.visa_data_service import (
    normalize_question,
    normalize_questions,
    resolve_sources,
    compute_required_missing,
    _evaluate_show_if,
    load_questions,
    load_scoring,
    load_sources,
    load_rules,
    load_blockers,
    CANONICAL_QUESTION_FIELDS,
    InvalidVisaTypeError,
    InvalidCountryError,
    DataNotFoundError,
    DataCorruptedError,
    StorageUnavailableError,
    StorageConfigError,
)


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

USA_SOURCES = {
    "country": "USA",
    "sources": {
        "usa_src_state_dept": {
            "name": "US Department of State — Student Visa",
            "url": "https://travel.state.gov/student",
        },
        "usa_src_dhs": {
            "name": "DHS Study in the States",
            "url": "https://studyinthestates.dhs.gov/",
        },
    },
}


def _raw_question(**overrides):
    """Build a minimal raw question dict using canonical field names."""
    base = {
        "id": "aus_has_coe",
        "question": "Do you have a CoE?",
        "help_text": "A CoE is required.",
        "input_type": "yes_no",
        "options": [{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}],
        "required": True,
        "scoring_key": "cat_core",
        "risk_category": "Critical",
        "validation": {"pass_if": {"type": "eq", "value": "yes"}},
        "show_if": None,
        "normalized_answer_format": "boolean",
        "error_message": "You need a CoE.",
        "blocker_possible": True,
        "source_url": "https://example.com",
    }
    base.update(overrides)
    return base


# ===========================================================================
# normalize_question — canonical fields
# ===========================================================================

class TestNormalizeQuestionCanonicalFields:
    def test_returns_id(self):
        q = normalize_question(_raw_question(id="aus_q1"))
        assert q["id"] == "aus_q1"

    def test_returns_question(self):
        q = normalize_question(_raw_question(question="Is your passport valid?"))
        assert q["question"] == "Is your passport valid?"

    def test_returns_help_text(self):
        q = normalize_question(_raw_question(help_text="Check expiry date."))
        assert q["help_text"] == "Check expiry date."

    def test_returns_input_type(self):
        q = normalize_question(_raw_question(input_type="text"))
        assert q["input_type"] == "text"

    def test_returns_options(self):
        opts = [{"label": "Yes", "value": "yes"}]
        q = normalize_question(_raw_question(options=opts))
        assert q["options"] == opts

    def test_returns_required(self):
        q = normalize_question(_raw_question(required=False))
        assert q["required"] is False

    def test_returns_scoring_key(self):
        q = normalize_question(_raw_question(scoring_key="cat_financial"))
        assert q["scoring_key"] == "cat_financial"

    def test_returns_risk_category(self):
        q = normalize_question(_raw_question(risk_category="High"))
        assert q["risk_category"] == "High"

    def test_returns_validation(self):
        val = {"pass_if": {"type": "eq", "value": "yes"}}
        q = normalize_question(_raw_question(validation=val))
        assert q["validation"] == val

    def test_returns_show_if(self):
        si = {"question_id": "q1", "operator": "eq", "value": "yes"}
        q = normalize_question(_raw_question(show_if=si))
        assert q["show_if"] == si

    def test_returns_normalized_answer_format(self):
        q = normalize_question(_raw_question(normalized_answer_format="string"))
        assert q["normalized_answer_format"] == "string"

    def test_returns_error_message(self):
        q = normalize_question(_raw_question(error_message="Fix this."))
        assert q["error_message"] == "Fix this."

    def test_returns_blocker_possible(self):
        q = normalize_question(_raw_question(blocker_possible=False))
        assert q["blocker_possible"] is False

    def test_returns_source_url(self):
        q = normalize_question(_raw_question(source_url="https://immi.gov.au"))
        assert q["source_url"] == "https://immi.gov.au"

    def test_returns_source_ids_when_present(self):
        q = normalize_question(_raw_question(source_ids=["usa_src_state_dept"]))
        assert q["source_ids"] == ["usa_src_state_dept"]

    def test_source_ids_absent_when_not_in_raw(self):
        raw = _raw_question()
        raw.pop("source_ids", None)
        q = normalize_question(raw)
        assert "source_ids" not in q


class TestNormalizeQuestionDoesNotReturnOldFields:
    """Old field names must NEVER appear in the normalized output."""

    def test_question_id_not_returned(self):
        raw = _raw_question()
        raw["question_id"] = "old_q_id"
        q = normalize_question(raw)
        assert "question_id" not in q

    def test_question_text_not_returned(self):
        raw = _raw_question()
        raw["question_text"] = "Old question text?"
        q = normalize_question(raw)
        assert "question_text" not in q

    def test_user_help_text_not_returned(self):
        raw = _raw_question()
        raw["user_help_text"] = "Old help text."
        q = normalize_question(raw)
        assert "user_help_text" not in q

    def test_critical_blocker_if_not_returned(self):
        raw = _raw_question()
        raw["critical_blocker_if"] = "something"
        q = normalize_question(raw)
        assert "critical_blocker_if" not in q

    def test_arbitrary_unknown_field_stripped(self):
        raw = _raw_question()
        raw["invented_field_xyz"] = "value"
        q = normalize_question(raw)
        assert "invented_field_xyz" not in q


class TestNormalizeQuestionFieldRemapping:
    """Old field names should be remapped to canonical counterparts."""

    def test_question_id_remapped_to_id(self):
        """question_id -> id when id is absent."""
        raw = {"question_id": "old_q1", "question": "Q?", "help_text": "H"}
        q = normalize_question(raw)
        assert q["id"] == "old_q1"

    def test_id_takes_priority_over_question_id(self):
        """When both present, canonical id wins."""
        raw = {"id": "canonical_id", "question_id": "old_id"}
        q = normalize_question(raw)
        assert q["id"] == "canonical_id"

    def test_question_text_remapped_to_question(self):
        raw = {"id": "q1", "question_text": "Is this right?"}
        q = normalize_question(raw)
        assert q["question"] == "Is this right?"

    def test_question_takes_priority_over_question_text(self):
        raw = {"id": "q1", "question": "Canonical Q?", "question_text": "Old Q?"}
        q = normalize_question(raw)
        assert q["question"] == "Canonical Q?"

    def test_user_help_text_remapped_to_help_text(self):
        raw = {"id": "q1", "user_help_text": "Old help."}
        q = normalize_question(raw)
        assert q["help_text"] == "Old help."

    def test_help_text_takes_priority_over_user_help_text(self):
        raw = {"id": "q1", "help_text": "New help.", "user_help_text": "Old help."}
        q = normalize_question(raw)
        assert q["help_text"] == "New help."


# ===========================================================================
# normalize_questions — list handling
# ===========================================================================

class TestNormalizeQuestions:
    def test_normalizes_list_of_questions(self):
        raw = [_raw_question(id="q1"), _raw_question(id="q2")]
        qs = normalize_questions(raw)
        assert len(qs) == 2
        assert qs[0]["id"] == "q1"
        assert qs[1]["id"] == "q2"

    def test_drops_non_dict_entries(self):
        raw = [_raw_question(id="q1"), "not_a_dict", None, 42, _raw_question(id="q2")]
        qs = normalize_questions(raw)
        assert len(qs) == 2

    def test_returns_empty_list_for_non_list_input(self):
        assert normalize_questions("not_a_list") == []
        assert normalize_questions(None) == []
        assert normalize_questions({}) == []

    def test_returns_empty_list_for_empty_list(self):
        assert normalize_questions([]) == []

    def test_strips_old_fields_in_batch(self):
        raw = [
            dict(_raw_question(id="q1"), question_id="old", user_help_text="old_help"),
        ]
        qs = normalize_questions(raw)
        assert "question_id" not in qs[0]
        assert "user_help_text" not in qs[0]


# ===========================================================================
# resolve_sources — USA source_ids resolved, unresolved safe, None sources safe
# ===========================================================================

class TestResolveSources:
    def test_usa_source_id_resolved(self):
        q = _raw_question(source_ids=["usa_src_state_dept"])
        result = resolve_sources([q], USA_SOURCES)
        assert "resolved_sources" in result[0]
        assert result[0]["resolved_sources"][0]["source_id"] == "usa_src_state_dept"
        assert result[0]["resolved_sources"][0]["name"] == "US Department of State — Student Visa"

    def test_resolved_source_contains_url(self):
        q = _raw_question(source_ids=["usa_src_dhs"])
        result = resolve_sources([q], USA_SOURCES)
        assert result[0]["resolved_sources"][0]["url"] == "https://studyinthestates.dhs.gov/"

    def test_multiple_source_ids_all_resolved(self):
        q = _raw_question(source_ids=["usa_src_state_dept", "usa_src_dhs"])
        result = resolve_sources([q], USA_SOURCES)
        assert len(result[0]["resolved_sources"]) == 2

    def test_original_source_ids_preserved(self):
        """source_ids must remain on the question after resolution."""
        q = _raw_question(source_ids=["usa_src_state_dept"])
        result = resolve_sources([q], USA_SOURCES)
        assert result[0]["source_ids"] == ["usa_src_state_dept"]

    def test_unresolved_source_id_does_not_crash(self):
        q = _raw_question(source_ids=["nonexistent_src_999"])
        result = resolve_sources([q], USA_SOURCES)
        assert result[0].get("resolved_sources", []) == []

    def test_unresolved_source_id_appears_in_unresolved_field(self):
        q = _raw_question(source_ids=["nonexistent_src_999"])
        result = resolve_sources([q], USA_SOURCES)
        assert "unresolved_source_ids" in result[0]
        assert "nonexistent_src_999" in result[0]["unresolved_source_ids"]

    def test_partial_resolution_splits_resolved_and_unresolved(self):
        q = _raw_question(source_ids=["usa_src_state_dept", "bad_id_xxx"])
        result = resolve_sources([q], USA_SOURCES)
        assert len(result[0]["resolved_sources"]) == 1
        assert result[0]["resolved_sources"][0]["source_id"] == "usa_src_state_dept"
        assert "bad_id_xxx" in result[0]["unresolved_source_ids"]

    def test_non_usa_country_without_sources_json_works(self):
        """When sources_data is None (no sources.json), questions pass through unchanged."""
        q = _raw_question(id="uk_q1")
        result = resolve_sources([q], sources_data=None)
        assert result[0]["id"] == "uk_q1"
        assert "resolved_sources" not in result[0]
        assert "unresolved_source_ids" not in result[0]

    def test_question_without_source_ids_passes_through(self):
        raw = _raw_question()
        raw.pop("source_ids", None)
        result = resolve_sources([raw], USA_SOURCES)
        assert "resolved_sources" not in result[0]
        assert "unresolved_source_ids" not in result[0]

    def test_empty_source_ids_list_passes_through(self):
        q = _raw_question(source_ids=[])
        result = resolve_sources([q], USA_SOURCES)
        assert "resolved_sources" not in result[0]
        assert "unresolved_source_ids" not in result[0]

    def test_malformed_sources_data_returns_questions_unchanged(self):
        """If sources_data is not a dict, return questions unchanged (no crash)."""
        q = _raw_question(source_ids=["some_id"])
        result = resolve_sources([q], sources_data="not_a_dict")
        assert result[0] is q  # unchanged

    def test_empty_sources_map_all_unresolved(self):
        sources = {"sources": {}}
        q = _raw_question(source_ids=["some_src"])
        result = resolve_sources([q], sources)
        assert result[0]["unresolved_source_ids"] == ["some_src"]


# ===========================================================================
# _evaluate_show_if — condition evaluator
# ===========================================================================

class TestEvaluateShowIf:
    def test_none_show_if_always_visible(self):
        assert _evaluate_show_if(None, {}) is True

    def test_non_dict_show_if_defaults_visible(self):
        assert _evaluate_show_if("q1 = yes", {}) is True

    def test_eq_matching_answer_visible(self):
        si = {"question_id": "q1", "operator": "eq", "value": "yes"}
        assert _evaluate_show_if(si, {"q1": "yes"}) is True

    def test_eq_non_matching_answer_hidden(self):
        si = {"question_id": "q1", "operator": "eq", "value": "yes"}
        assert _evaluate_show_if(si, {"q1": "no"}) is False

    def test_eq_case_insensitive(self):
        si = {"question_id": "q1", "operator": "eq", "value": "yes"}
        assert _evaluate_show_if(si, {"q1": "YES"}) is True

    def test_eq_missing_parent_answer_hidden(self):
        si = {"question_id": "q1", "operator": "eq", "value": "yes"}
        assert _evaluate_show_if(si, {}) is False

    def test_neq_visible_when_different(self):
        si = {"question_id": "q1", "operator": "neq", "value": "no"}
        assert _evaluate_show_if(si, {"q1": "yes"}) is True

    def test_neq_hidden_when_same(self):
        si = {"question_id": "q1", "operator": "neq", "value": "no"}
        assert _evaluate_show_if(si, {"q1": "no"}) is False

    def test_in_visible_when_in_list(self):
        si = {"question_id": "q1", "operator": "in", "value": ["yes", "not_applicable"]}
        assert _evaluate_show_if(si, {"q1": "yes"}) is True

    def test_in_hidden_when_not_in_list(self):
        si = {"question_id": "q1", "operator": "in", "value": ["yes", "not_applicable"]}
        assert _evaluate_show_if(si, {"q1": "no"}) is False

    def test_not_in_visible_when_not_in_list(self):
        si = {"question_id": "q1", "operator": "not_in", "value": ["no"]}
        assert _evaluate_show_if(si, {"q1": "yes"}) is True

    def test_multi_contains_visible_when_answer_contains_value(self):
        si = {"question_id": "q1", "operator": "multi_contains", "value": "family_ties"}
        assert _evaluate_show_if(si, {"q1": ["family_ties", "savings"]}) is True

    def test_multi_contains_hidden_when_answer_does_not_contain_value(self):
        si = {"question_id": "q1", "operator": "multi_contains", "value": "family_ties"}
        assert _evaluate_show_if(si, {"q1": ["savings"]}) is False

    def test_and_both_true_visible(self):
        si = {
            "operator": "and",
            "conditions": [
                {"question_id": "q1", "operator": "eq", "value": "yes"},
                {"question_id": "q2", "operator": "eq", "value": "yes"},
            ],
        }
        assert _evaluate_show_if(si, {"q1": "yes", "q2": "yes"}) is True

    def test_and_one_false_hidden(self):
        si = {
            "operator": "and",
            "conditions": [
                {"question_id": "q1", "operator": "eq", "value": "yes"},
                {"question_id": "q2", "operator": "eq", "value": "yes"},
            ],
        }
        assert _evaluate_show_if(si, {"q1": "yes", "q2": "no"}) is False

    def test_or_one_true_visible(self):
        si = {
            "operator": "or",
            "conditions": [
                {"question_id": "q1", "operator": "eq", "value": "yes"},
                {"question_id": "q2", "operator": "eq", "value": "yes"},
            ],
        }
        assert _evaluate_show_if(si, {"q1": "no", "q2": "yes"}) is True

    def test_or_both_false_hidden(self):
        si = {
            "operator": "or",
            "conditions": [
                {"question_id": "q1", "operator": "eq", "value": "yes"},
                {"question_id": "q2", "operator": "eq", "value": "yes"},
            ],
        }
        assert _evaluate_show_if(si, {"q1": "no", "q2": "no"}) is False

    def test_unknown_operator_defaults_visible(self):
        si = {"question_id": "q1", "operator": "invented_op", "value": "yes"}
        assert _evaluate_show_if(si, {"q1": "yes"}) is True


# ===========================================================================
# compute_required_missing
# ===========================================================================

class TestComputeRequiredMissing:
    def _q(self, qid, required=True, show_if=None):
        return {
            "id": qid,
            "required": required,
            "show_if": show_if,
        }

    def test_required_visible_missing_answer_in_result(self):
        questions = [self._q("q1")]
        missing = compute_required_missing(questions, {})
        assert "q1" in missing

    def test_required_visible_answered_not_in_result(self):
        questions = [self._q("q1")]
        missing = compute_required_missing(questions, {"q1": "yes"})
        assert "q1" not in missing

    def test_required_empty_string_answer_is_missing(self):
        questions = [self._q("q1")]
        missing = compute_required_missing(questions, {"q1": ""})
        assert "q1" in missing

    def test_required_empty_list_answer_is_missing(self):
        questions = [self._q("q1")]
        missing = compute_required_missing(questions, {"q1": []})
        assert "q1" in missing

    def test_optional_question_not_in_result_even_if_unanswered(self):
        questions = [self._q("q1", required=False)]
        missing = compute_required_missing(questions, {})
        assert "q1" not in missing

    def test_hidden_show_if_question_excluded_even_if_required(self):
        """A required question hidden by show_if must NOT appear in missing."""
        parent = self._q("parent_q")
        child = self._q(
            "child_q",
            required=True,
            show_if={"question_id": "parent_q", "operator": "eq", "value": "yes"},
        )
        # parent answered "no" -> child is hidden -> must not be required
        missing = compute_required_missing(
            [parent, child],
            {"parent_q": "no"},
        )
        assert "child_q" not in missing

    def test_hidden_show_if_question_appears_when_visible(self):
        """When parent answer satisfies show_if, child is visible and required."""
        parent = self._q("parent_q")
        child = self._q(
            "child_q",
            required=True,
            show_if={"question_id": "parent_q", "operator": "eq", "value": "yes"},
        )
        missing = compute_required_missing(
            [parent, child],
            {"parent_q": "yes"},  # child now visible
        )
        assert "child_q" in missing

    def test_always_visible_required_question_is_missing(self):
        questions = [self._q("q_always", required=True, show_if=None)]
        missing = compute_required_missing(questions, {})
        assert "q_always" in missing

    def test_multiple_required_missing_all_returned(self):
        questions = [self._q("q1"), self._q("q2"), self._q("q3")]
        missing = compute_required_missing(questions, {"q2": "yes"})
        assert "q1" in missing
        assert "q2" not in missing
        assert "q3" in missing

    def test_non_dict_entries_in_questions_are_skipped(self):
        questions = [self._q("q1"), "not_a_dict", None]
        missing = compute_required_missing(questions, {})
        assert "q1" in missing

    def test_question_with_no_id_is_skipped(self):
        questions = [{"required": True, "show_if": None}]
        missing = compute_required_missing(questions, {})
        assert missing == []

    def test_nested_and_show_if_hides_question(self):
        """AND condition: both must be true for question to be visible."""
        child = self._q(
            "child_q",
            required=True,
            show_if={
                "operator": "and",
                "conditions": [
                    {"question_id": "q1", "operator": "eq", "value": "yes"},
                    {"question_id": "q2", "operator": "eq", "value": "yes"},
                ],
            },
        )
        # q2=no -> AND fails -> child hidden -> not in missing
        missing = compute_required_missing(
            [self._q("q1"), self._q("q2"), child],
            {"q1": "yes", "q2": "no"},
        )
        assert "child_q" not in missing


# ===========================================================================
# R2 / Redis load_* behavior (mocked)
# ===========================================================================

_DUMMY_QUESTIONS = [{"id": "q1", "question": "Q?"}]
_DUMMY_SCORING = {"score_bands": [], "scoring_categories": [], "critical_blockers_hard": [], "high_risk_flags": [], "config": {}}


def _make_r2_client(json_data):
    """Return a mock boto3 S3 client that returns json_data as a JSON body."""
    body_mock = MagicMock()
    body_mock.read.return_value = json.dumps(json_data).encode()
    client = MagicMock()
    client.get_object.return_value = {"Body": body_mock}
    return client


def _make_r2_not_found():
    """Return a mock boto3 S3 client that raises 404 NoSuchKey."""
    from botocore.exceptions import ClientError
    client = MagicMock()
    error_response = {"Error": {"Code": "NoSuchKey", "Message": "Not Found"}}
    client.get_object.side_effect = ClientError(error_response, "GetObject")
    return client


_R2_ENV = {
    "R2_ENDPOINT_URL": "https://fake.r2.cloudflarestorage.com",
    "R2_ACCESS_KEY_ID": "fake_key",
    "R2_SECRET_ACCESS_KEY": "fake_secret",
    "R2_BUCKET_NAME": "test-bucket",
    "R2_PREFIX": "parchivisa-data",
}


class TestLoadQuestions:
    def test_loads_questions_from_r2(self):
        r2 = _make_r2_client(_DUMMY_QUESTIONS)
        with patch.dict("os.environ", _R2_ENV), \
             patch("services.visa_data_service._get_r2_client", return_value=r2), \
             patch("services.visa_data_service._cache_get", return_value=None), \
             patch("services.visa_data_service._cache_set"):
            result = load_questions("student_visa", "australia")
        assert result == _DUMMY_QUESTIONS

    def test_returns_cached_value_without_r2_call(self):
        r2 = MagicMock()
        with patch.dict("os.environ", _R2_ENV), \
             patch("services.visa_data_service._get_r2_client", return_value=r2), \
             patch("services.visa_data_service._cache_get", return_value=_DUMMY_QUESTIONS):
            result = load_questions("student_visa", "uk")
        assert result == _DUMMY_QUESTIONS
        r2.get_object.assert_not_called()

    def test_raises_invalid_visa_type(self):
        with pytest.raises(InvalidVisaTypeError):
            load_questions("work_visa", "australia")

    def test_raises_invalid_country(self):
        with pytest.raises(InvalidCountryError):
            load_questions("student_visa", "germany")

    def test_raises_data_not_found_on_404(self):
        r2 = _make_r2_not_found()
        with patch.dict("os.environ", _R2_ENV), \
             patch("services.visa_data_service._get_r2_client", return_value=r2), \
             patch("services.visa_data_service._cache_get", return_value=None):
            with pytest.raises(DataNotFoundError):
                load_questions("student_visa", "usa")

    def test_raises_storage_config_error_when_env_missing(self):
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(StorageConfigError):
                load_questions("student_visa", "canada")


class TestLoadSources:
    def test_usa_sources_loaded_when_present(self):
        r2 = _make_r2_client(USA_SOURCES)
        with patch.dict("os.environ", _R2_ENV), \
             patch("services.visa_data_service._get_r2_client", return_value=r2), \
             patch("services.visa_data_service._cache_get", return_value=None), \
             patch("services.visa_data_service._cache_set"):
            result = load_sources("student_visa", "usa")
        assert result is not None
        assert "sources" in result

    def test_non_usa_country_returns_none_on_404(self):
        """UK, Canada, Australia have no sources.json — must return None, not raise."""
        r2 = _make_r2_not_found()
        with patch.dict("os.environ", _R2_ENV), \
             patch("services.visa_data_service._get_r2_client", return_value=r2), \
             patch("services.visa_data_service._cache_get", return_value=None):
            result = load_sources("student_visa", "uk")
        assert result is None

    def test_sources_cached_on_first_load(self):
        r2 = _make_r2_client(USA_SOURCES)
        cache_set_calls = []

        def fake_cache_set(key, data):
            cache_set_calls.append((key, data))

        with patch.dict("os.environ", _R2_ENV), \
             patch("services.visa_data_service._get_r2_client", return_value=r2), \
             patch("services.visa_data_service._cache_get", return_value=None), \
             patch("services.visa_data_service._cache_set", side_effect=fake_cache_set):
            load_sources("student_visa", "usa")

        assert len(cache_set_calls) == 1
        assert "usa" in cache_set_calls[0][0]


class TestLoadOptionalFiles:
    def test_load_rules_returns_none_on_404(self):
        r2 = _make_r2_not_found()
        with patch.dict("os.environ", _R2_ENV), \
             patch("services.visa_data_service._get_r2_client", return_value=r2), \
             patch("services.visa_data_service._cache_get", return_value=None):
            result = load_rules("student_visa", "australia")
        assert result is None

    def test_load_blockers_returns_none_on_404(self):
        r2 = _make_r2_not_found()
        with patch.dict("os.environ", _R2_ENV), \
             patch("services.visa_data_service._get_r2_client", return_value=r2), \
             patch("services.visa_data_service._cache_get", return_value=None):
            result = load_blockers("student_visa", "canada")
        assert result is None

    def test_load_rules_returns_data_when_present(self):
        dummy_rules = [{"rule_id": "r1", "rule": "Rule text."}]
        r2 = _make_r2_client(dummy_rules)
        with patch.dict("os.environ", _R2_ENV), \
             patch("services.visa_data_service._get_r2_client", return_value=r2), \
             patch("services.visa_data_service._cache_get", return_value=None), \
             patch("services.visa_data_service._cache_set"):
            result = load_rules("student_visa", "australia")
        assert result == dummy_rules
