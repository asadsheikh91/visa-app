"""
tests/test_validate_visa_data.py

Unit tests for the validate_visa_data validator functions.
No I/O or R2 access -- all tests use inline mock data.
"""

import pytest
from scripts.validate_visa_data import (
    validate_questions,
    validate_scoring,
    validate_sources,
    validate_rules,
    validate_country,
    Issue,
    SUPPORTED_INPUT_TYPES,
    DEPRECATED_INPUT_TYPES,
)


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

CATS = [
    {"category_id": "cat_a", "label": "Cat A", "max_points": 10, "question_ids": []},
    {"category_id": "cat_b", "label": "Cat B", "max_points": 20, "question_ids": []},
]

BANDS = [
    {"min": 85, "max": 100, "label": "Strong",   "description": "Strong"},
    {"min": 0,  "max": 84,  "label": "Needs Work","description": "Work"},
]

USA_SOURCES = {
    "sources": {
        "usa_src_state_dept": {"name": "State Dept", "url": "https://travel.state.gov"},
        "usa_src_dhs":        {"name": "DHS",        "url": "https://dhs.gov"},
    }
}


def _q(**overrides):
    """Build a minimal valid question dict."""
    base = {
        "id":                      "q1",
        "country":                 "Australia",
        "visa_route":              "Student Visa",
        "section":                 "Profile",
        "question":                "Do you have a CoE?",
        "help_text":               "A CoE is required.",
        "input_type":              "yes_no",
        "required":                True,
        "options":                 [
            {"label": "Yes", "value": "yes"},
            {"label": "No",  "value": "no"},
        ],
        "validation": {
            "pass_if":    {"type": "eq", "value": "yes"},
            "trigger_if": {"type": "eq", "value": "no"},
        },
        "show_if":                 None,
        "scoring_key":             "cat_a",
        "score_impact":            5,
        "risk_category":           "Critical",
        "tier":                    "hard",
        "blocker_possible":        True,
        "normalized_answer_format":"boolean",
        "error_message":           "You need a CoE.",
        "mapped_rule":             "CoE Required",
        "mapped_rule_id":          "aus_student_coe",
        "source_url":              "https://example.com",
        "source_resolution_status":"direct_url",
        "last_verified":           "2026-05-29",
    }
    base.update(overrides)
    return base


def _scoring(**overrides):
    """Build a minimal valid scoring dict."""
    base = {
        "score_bands":          BANDS,
        "scoring_categories":   CATS,
        "critical_blockers_hard": [],
        "high_risk_flags":      [],
        "soft_warnings":        [],
        "config":               {},
    }
    base.update(overrides)
    return base


def errors_for(issues):
    return [i for i in issues if i.level == "error"]

def warnings_for(issues):
    return [i for i in issues if i.level == "warning"]

def has_error(issues, field_substr=None, msg_substr=None):
    for i in errors_for(issues):
        if field_substr and field_substr not in i.field and field_substr not in i.item_id:
            continue
        if msg_substr and msg_substr not in i.message:
            continue
        return True
    return False

def has_warning(issues, field_substr=None, msg_substr=None):
    for i in warnings_for(issues):
        if field_substr and field_substr not in i.field and field_substr not in i.item_id:
            continue
        if msg_substr and msg_substr not in i.message:
            continue
        return True
    return False


# ===========================================================================
# validate_questions -- required fields
# ===========================================================================

class TestRequiredFields:
    def test_valid_question_passes(self):
        issues = validate_questions("aus", [_q()], CATS)
        assert errors_for(issues) == []

    def test_missing_id_is_error(self):
        q = _q()
        del q["id"]
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "id")

    def test_old_question_id_field_is_error(self):
        q = _q()
        del q["id"]
        q["question_id"] = "q1"
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "id", "question_id")

    def test_missing_question_text_is_error(self):
        q = _q()
        del q["question"]
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "question")

    def test_old_question_text_field_is_error(self):
        q = _q()
        del q["question"]
        q["question_text"] = "Do you have a CoE?"
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "question", "question_text")

    def test_missing_scoring_key_is_error(self):
        q = _q()
        del q["scoring_key"]
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "scoring_key")

    def test_missing_risk_category_is_error(self):
        q = _q()
        del q["risk_category"]
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "risk_category")

    def test_missing_blocker_possible_is_error(self):
        q = _q()
        del q["blocker_possible"]
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "blocker_possible")

    def test_missing_normalized_answer_format_is_error(self):
        q = _q()
        del q["normalized_answer_format"]
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "normalized_answer_format")

    def test_missing_error_message_is_error(self):
        q = _q()
        del q["error_message"]
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "error_message")

    def test_missing_help_text_is_warning(self):
        q = _q()
        q.pop("help_text", None)
        q["help_text"] = None
        issues = validate_questions("aus", [q], CATS)
        assert has_warning(issues, "help_text")


# ===========================================================================
# validate_questions -- duplicate ID
# ===========================================================================

class TestDuplicateId:
    def test_duplicate_id_is_error(self):
        q1 = _q(id="q1")
        q2 = _q(id="q1")
        issues = validate_questions("aus", [q1, q2], CATS)
        assert has_error(issues, "id", "Duplicate")

    def test_unique_ids_no_error(self):
        q1 = _q(id="q1")
        q2 = _q(id="q2")
        issues = validate_questions("aus", [q1, q2], CATS)
        assert not has_error(issues, "id", "Duplicate")


# ===========================================================================
# validate_questions -- input_type
# ===========================================================================

class TestInputType:
    def test_supported_type_passes(self):
        for t in SUPPORTED_INPUT_TYPES:
            q = _q(input_type=t)
            if t in ("yes_no", "yes_no_unknown", "single_choice", "multi_choice"):
                pass  # needs options - already has them
            else:
                q["options"] = []
            issues = validate_questions("aus", [q], CATS)
            assert not has_error(issues, "input_type"), f"Expected no error for {t}"

    def test_deprecated_dropdown_is_error(self):
        q = _q(input_type="dropdown")
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "input_type", "Deprecated")

    def test_deprecated_yes_no_unsure_is_error(self):
        q = _q(input_type="yes_no_unsure")
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "input_type", "Deprecated")

    def test_deprecated_yes_no_na_is_error(self):
        q = _q(input_type="yes_no_na")
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "input_type", "Deprecated")

    def test_deprecated_multi_select_is_error(self):
        q = _q(input_type="multi_select")
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "input_type", "Deprecated")

    def test_unknown_type_is_error(self):
        q = _q(input_type="magic_input")
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "input_type", "Unknown")


# ===========================================================================
# validate_questions -- options
# ===========================================================================

class TestOptions:
    def test_label_value_objects_pass(self):
        q = _q(options=[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}])
        issues = validate_questions("aus", [q], CATS)
        assert not has_error(issues, "options")

    def test_raw_string_options_is_error(self):
        q = _q(options=["yes", "no"])
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "options[0]", "Raw string")

    def test_option_missing_label_is_error(self):
        q = _q(options=[{"value": "yes"}, {"label": "No", "value": "no"}])
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "options[0]", "label")

    def test_option_missing_value_is_error(self):
        q = _q(options=[{"label": "Yes"}, {"label": "No", "value": "no"}])
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "options[0]", "value")

    def test_yes_no_without_options_is_error(self):
        q = _q(input_type="yes_no", options=[])
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "options", "requires")

    def test_text_without_options_is_fine(self):
        q = _q(input_type="text", options=[])
        issues = validate_questions("aus", [q], CATS)
        assert not has_error(issues, "options")


# ===========================================================================
# validate_questions -- show_if
# ===========================================================================

class TestShowIf:
    def test_null_show_if_passes(self):
        q = _q(show_if=None)
        issues = validate_questions("aus", [q], CATS)
        assert not has_error(issues, "show_if")

    def test_freeform_string_show_if_is_error(self):
        q = _q(show_if="aus_edu_gap_over_1yr = yes")
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "show_if")

    def test_structured_show_if_passes(self):
        # reference self to avoid "missing qid" error -- use another valid q
        q1 = _q(id="q1", show_if=None)
        q2 = _q(id="q2", show_if={"question_id": "q1", "operator": "eq", "value": "yes"},
                required=False)
        issues = validate_questions("aus", [q1, q2], CATS)
        assert not has_error(issues, "show_if")

    def test_show_if_refs_missing_question_id_is_error(self):
        q = _q(show_if={"question_id": "nonexistent_q", "operator": "eq", "value": "yes"})
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "show_if", "nonexistent_q")

    def test_show_if_unsupported_operator_is_error(self):
        q1 = _q(id="q1", show_if=None)
        q2 = _q(id="q2", show_if={"question_id": "q1", "operator": "invented_op", "value": "yes"},
                required=False)
        issues = validate_questions("aus", [q1, q2], CATS)
        assert has_error(issues, "show_if.operator", "invented_op")

    def test_multi_contains_operator_is_valid(self):
        """multi_contains is valid for multi_choice parent questions."""
        q1 = _q(id="q1", input_type="multi_choice", show_if=None)
        q2 = _q(id="q2",
                show_if={"question_id": "q1", "operator": "multi_contains", "value": "yes"},
                required=False)
        issues = validate_questions("aus", [q1, q2], CATS)
        assert not has_error(issues, "show_if.operator")

    def test_show_if_required_true_no_not_applicable_is_warning(self):
        """required=True + show_if + no not_applicable option -> warning."""
        q1 = _q(id="q1", show_if=None)
        # q2 has show_if, required=True, and no not_applicable option
        q2 = _q(id="q2",
                show_if={"question_id": "q1", "operator": "eq", "value": "yes"},
                required=True,
                options=[{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}])
        issues = validate_questions("aus", [q1, q2], CATS)
        assert has_warning(issues, msg_substr="not_applicable")

    def test_show_if_required_false_no_not_applicable_no_warning(self):
        q1 = _q(id="q1", show_if=None)
        q2 = _q(id="q2",
                show_if={"question_id": "q1", "operator": "eq", "value": "yes"},
                required=False)
        issues = validate_questions("aus", [q1, q2], CATS)
        assert not has_warning(issues, msg_substr="not_applicable")


# ===========================================================================
# validate_questions -- validation conditions
# ===========================================================================

class TestValidationConditions:
    def test_canonical_validation_pass_if_passes(self):
        q = _q(validation={"pass_if": {"type": "eq", "value": "yes"},
                            "trigger_if": {"type": "eq", "value": "no"}})
        issues = validate_questions("aus", [q], CATS)
        assert not has_error(issues, "validation")

    def test_unknown_pass_if_type_is_error(self):
        q = _q(validation={"pass_if":    {"type": "invented_type"},
                            "trigger_if": {"type": "eq", "value": "no"}})
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "validation.pass_if", "invented_type")

    def test_unknown_trigger_if_type_is_error(self):
        q = _q(validation={"pass_if":    {"type": "eq", "value": "yes"},
                            "trigger_if": {"type": "bad_type"}})
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "validation.trigger_if", "bad_type")

    def test_computed_type_is_valid(self):
        q = _q(input_type="currency_amount", options=[],
               validation={"pass_if":    {"type": "computed_funds_ok"},
                           "trigger_if": {"type": "computed_funds_short"}})
        issues = validate_questions("aus", [q], CATS)
        assert not has_error(issues, "validation")

    def test_in_with_list_is_valid(self):
        q = _q(validation={"pass_if":    {"type": "in", "value": ["yes", "not_applicable"]},
                            "trigger_if": {"type": "eq", "value": "no"}})
        issues = validate_questions("aus", [q], CATS)
        assert not has_error(issues, "validation")

    def test_in_with_string_is_error(self):
        q = _q(validation={"pass_if":    {"type": "eq", "value": "yes"},
                            "trigger_if": {"type": "in", "value": "no"}})
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "validation.trigger_if", "list value")


class TestUKFlatPassIf:
    """UK compat: flat pass_if / trigger_if at question level (no validation wrapper)."""

    def test_flat_pass_if_validates(self):
        q = _q()
        del q["validation"]
        q["pass_if"]    = {"type": "eq", "value": "yes"}
        q["trigger_if"] = {"type": "eq", "value": "no"}
        issues = validate_questions("uk", [q], CATS)
        assert not has_error(issues, "validation")

    def test_flat_pass_if_unknown_type_is_error(self):
        q = _q()
        del q["validation"]
        q["pass_if"]    = {"type": "invented_flat"}
        q["trigger_if"] = {"type": "eq", "value": "no"}
        issues = validate_questions("uk", [q], CATS)
        assert has_error(issues, "validation.pass_if", "invented_flat")


# ===========================================================================
# validate_questions -- scoring_key cross-reference
# ===========================================================================

class TestScoringKeyCrossRef:
    def test_valid_scoring_key_passes(self):
        q = _q(scoring_key="cat_a")
        issues = validate_questions("aus", [q], CATS)
        assert not has_error(issues, "scoring_key")

    def test_scoring_key_not_in_categories_is_error(self):
        q = _q(scoring_key="nonexistent_category")
        issues = validate_questions("aus", [q], CATS)
        assert has_error(issues, "scoring_key", "nonexistent_category")


# ===========================================================================
# validate_scoring
# ===========================================================================

class TestScoringValidation:
    def test_valid_scoring_passes(self):
        s = _scoring()
        issues = validate_scoring("aus", s, {"q1", "q2"})
        assert errors_for(issues) == []

    def test_old_critical_blockers_key_is_error(self):
        s = _scoring()
        del s["critical_blockers_hard"]
        s["critical_blockers"] = []  # old key
        issues = validate_scoring("aus", s, set())
        assert has_error(issues, "critical_blockers", "rename")

    def test_missing_critical_blockers_hard_is_error(self):
        s = _scoring()
        del s["critical_blockers_hard"]
        issues = validate_scoring("aus", s, set())
        assert has_error(issues, "critical_blockers_hard")

    def test_missing_high_risk_flags_is_error(self):
        s = _scoring()
        del s["high_risk_flags"]
        issues = validate_scoring("aus", s, set())
        assert has_error(issues, "high_risk_flags")

    def test_blocker_refs_missing_question_id_is_error(self):
        blocker = {"question_id": "missing_q", "trigger_if": {"type": "eq", "value": "no"},
                   "mapped_rule": "A rule", "conditional_on": None, "message": "Stop."}
        s = _scoring(critical_blockers_hard=[blocker])
        issues = validate_scoring("aus", s, {"q1"})
        assert has_error(issues, "critical_blockers_hard.question_id", "missing_q")

    def test_blocker_refs_existing_question_id_passes(self):
        blocker = {"question_id": "q1", "trigger_if": {"type": "eq", "value": "no"},
                   "mapped_rule": "A rule", "conditional_on": None, "message": "Stop."}
        s = _scoring(critical_blockers_hard=[blocker])
        issues = validate_scoring("aus", s, {"q1"})
        assert not has_error(issues, "critical_blockers_hard.question_id")

    def test_freeform_conditional_on_is_error(self):
        blocker = {"question_id": "q1", "trigger_if": {"type": "eq", "value": "no"},
                   "mapped_rule": "A rule", "conditional_on": "aus_something = yes",
                   "message": "Stop."}
        s = _scoring(critical_blockers_hard=[blocker])
        issues = validate_scoring("aus", s, {"q1"})
        assert has_error(issues, "conditional_on")

    def test_structured_conditional_on_passes(self):
        blocker = {"question_id": "q1", "trigger_if": {"type": "eq", "value": "no"},
                   "mapped_rule": "A rule",
                   "conditional_on": {"question_id": "q2", "operator": "eq", "value": "yes"},
                   "message": "Stop."}
        s = _scoring(critical_blockers_hard=[blocker])
        issues = validate_scoring("aus", s, {"q1", "q2"})
        assert not has_error(issues, "conditional_on")

    def test_conditional_on_refs_missing_qid_is_error(self):
        blocker = {"question_id": "q1", "trigger_if": {"type": "eq", "value": "no"},
                   "mapped_rule": "A rule",
                   "conditional_on": {"question_id": "missing_parent", "operator": "eq", "value": "yes"},
                   "message": "Stop."}
        s = _scoring(critical_blockers_hard=[blocker])
        issues = validate_scoring("aus", s, {"q1"})
        assert has_error(issues, "conditional_on.question_id", "missing_parent")

    def test_trigger_if_in_with_non_list_is_error(self):
        sw = {"question_id": "q1",
              "trigger_if": {"type": "in", "value": "no"},  # BUG: should be list
              "mapped_rule": "A rule", "conditional_on": None, "message": "Warn."}
        s = _scoring(soft_warnings=[sw])
        issues = validate_scoring("aus", s, {"q1"})
        assert has_error(issues, "trigger_if", "list value")

    def test_trigger_if_in_with_list_passes(self):
        sw = {"question_id": "q1",
              "trigger_if": {"type": "in", "value": ["no"]},  # correct
              "mapped_rule": "A rule", "conditional_on": None, "message": "Warn."}
        s = _scoring(soft_warnings=[sw])
        issues = validate_scoring("aus", s, {"q1"})
        assert not has_error(issues, "trigger_if")

    def test_scoring_category_refs_missing_qid_is_error(self):
        cats = [{"category_id": "cat_a", "label": "Cat A", "max_points": 10,
                 "question_ids": ["q1", "missing_q"]}]
        s = _scoring(scoring_categories=cats)
        issues = validate_scoring("aus", s, {"q1"})
        assert has_error(issues, "scoring_categories.question_ids", "missing_q")

    def test_computed_config_missing_is_error(self):
        blocker = {"question_id": "q1",
                   "trigger_if": {"type": "computed_funds_short"},
                   "mapped_rule": "Funds", "conditional_on": None, "message": "Funds."}
        s = _scoring(critical_blockers_hard=[blocker], config={})
        del s["config"]
        issues = validate_scoring("aus", s, {"q1"})
        assert has_error(issues, "config")

    def test_computed_with_config_passes(self):
        blocker = {"question_id": "q1",
                   "trigger_if": {"type": "computed_funds_short"},
                   "mapped_rule": "Funds", "conditional_on": None, "message": "Funds."}
        s = _scoring(critical_blockers_hard=[blocker],
                     config={"living_cost_single_12m": 29710})
        issues = validate_scoring("aus", s, {"q1"})
        assert not has_error(issues, "config")


# ===========================================================================
# validate_sources
# ===========================================================================

class TestValidateSources:
    def test_usa_source_ids_resolve(self):
        q = _q(source_ids=["usa_src_state_dept"])
        issues = validate_sources("usa", [q], USA_SOURCES)
        assert errors_for(issues) == []

    def test_unresolved_source_id_is_error(self):
        q = _q(source_ids=["usa_src_nonexistent"])
        issues = validate_sources("usa", [q], USA_SOURCES)
        assert has_error(issues, "source_ids", "usa_src_nonexistent")

    def test_no_sources_json_with_source_ids_is_warning(self):
        """When sources.json is absent but questions have source_ids: warning."""
        q = _q(source_ids=["some_source"])
        issues = validate_sources("uk", [q], sources_data=None)
        assert has_warning(issues, "source_ids")

    def test_no_sources_json_no_source_ids_no_issue(self):
        q = _q()  # no source_ids
        issues = validate_sources("uk", [q], sources_data=None)
        assert issues == []

    def test_all_source_ids_resolve(self):
        q1 = _q(id="q1", source_ids=["usa_src_state_dept"])
        q2 = _q(id="q2", source_ids=["usa_src_dhs"])
        issues = validate_sources("usa", [q1, q2], USA_SOURCES)
        assert errors_for(issues) == []


# ===========================================================================
# validate_country (integration)
# ===========================================================================

class TestValidateCountry:
    def test_clean_country_has_no_errors(self):
        questions = [_q()]
        scoring   = _scoring()
        issues, stats = validate_country("aus", questions, scoring)
        assert stats["errors"] == 0

    def test_stats_count_questions(self):
        questions = [_q(id="q1"), _q(id="q2")]
        scoring   = _scoring()
        _, stats = validate_country("aus", questions, scoring)
        assert stats["questions"] == 2

    def test_error_increments_error_count(self):
        q = _q()
        del q["id"]
        _, stats = validate_country("aus", [q], _scoring())
        assert stats["errors"] >= 1


# ===========================================================================
# Issue __str__
# ===========================================================================

class TestIssueStr:
    def test_str_includes_country(self):
        i = Issue("australia", "questions.json", "q1", "id", "Missing id", "error")
        assert "australia" in str(i)

    def test_str_includes_item_id(self):
        i = Issue("uk", "questions.json", "uk_has_cas", "show_if", "Bad show_if", "error")
        assert "uk_has_cas" in str(i)

    def test_str_includes_message(self):
        i = Issue("canada", "scoring.json", "", "critical_blockers_hard", "Missing section", "error")
        assert "Missing section" in str(i)


# ===========================================================================
# Real data integration (local files)
# ===========================================================================

import os as _os

# Determine the parchivisa-data path dynamically so tests are not tied to a
# specific session name.  Resolution order:
#   1. PARCHIVISA_DATA_PATH environment variable (CI / explicit override)
#   2. Repo-relative default: tests/ -> backend/ -> visa-app-main/ -> sibling parchivisa-data/
_THIS_TEST_DIR = _os.path.dirname(_os.path.abspath(__file__))
_MNT_DIR       = _os.path.dirname(_os.path.dirname(_os.path.dirname(_THIS_TEST_DIR)))
_DEFAULT_DATA  = _os.path.join(_MNT_DIR, "parchivisa-data")
_REAL_DATA_PATH = _os.environ.get("PARCHIVISA_DATA_PATH", _DEFAULT_DATA)


class TestRealData:
    """Runs the validator against the actual parchivisa-data directory."""

    DATA_PATH = _REAL_DATA_PATH

    def _run(self, country):
        import json, os
        if not os.path.isdir(self.DATA_PATH):
            pytest.skip(
                f"Real data not available at {self.DATA_PATH!r}. "
                "Set PARCHIVISA_DATA_PATH to point to the parchivisa-data directory."
            )
        base = os.path.join(self.DATA_PATH, "student", country)
        def load(f):
            with open(os.path.join(base, f)) as fp:
                return json.load(fp)
        questions = load("questions.json")
        scoring   = load("scoring.json")
        rules     = load("rules.json")
        src_path  = os.path.join(base, "sources.json")
        sources   = load("sources.json") if os.path.exists(src_path) else None
        issues, stats = validate_country(country, questions, scoring, sources, rules)
        return issues, stats

    def test_australia_passes(self):
        issues, stats = self._run("australia")
        errs = errors_for(issues)
        assert errs == [], "\n".join(str(i) for i in errs)

    def test_canada_passes(self):
        issues, stats = self._run("canada")
        errs = errors_for(issues)
        assert errs == [], "\n".join(str(i) for i in errs)

    def test_uk_passes(self):
        issues, stats = self._run("uk")
        errs = errors_for(issues)
        assert errs == [], "\n".join(str(i) for i in errs)

    def test_usa_passes(self):
        issues, stats = self._run("usa")
        errs = errors_for(issues)
        assert errs == [], "\n".join(str(i) for i in errs)

    def test_australia_question_count(self):
        _, stats = self._run("australia")
        assert stats["questions"] == 58

    def test_canada_question_count(self):
        _, stats = self._run("canada")
        assert stats["questions"] == 65
