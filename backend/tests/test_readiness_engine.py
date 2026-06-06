"""
tests/test_readiness_engine.py

Phase 1A — Focused unit tests for the structured condition evaluator
and _is_passing() pass-logic resolver.

Coverage:
  - evaluate_condition: every supported type
  - evaluate_condition: edge cases (None answer, malformed condition, computed types)
  - _is_passing: canonical validation.pass_if
  - _is_passing: flat pass_if (UK legacy compat)
  - _is_passing: priority ordering (validation beats flat)
  - _is_passing: no pass_if defined (safe fallback)
"""

import pytest
from services.readiness_engine import (
    evaluate_condition,
    _is_passing,
    _get_pass_if,
    _to_numeric,
    _to_list,
)


# ─── _to_numeric ──────────────────────────────────────────────────────────────

class TestToNumeric:
    def test_integer(self):
        assert _to_numeric(25) == 25.0

    def test_float(self):
        assert _to_numeric(1.5) == 1.5

    def test_numeric_string(self):
        assert _to_numeric("18") == 18.0

    def test_string_with_comma(self):
        assert _to_numeric("13,000") == 13000.0

    def test_string_with_spaces(self):
        assert _to_numeric(" 50 ") == 50.0

    def test_non_numeric_string(self):
        assert _to_numeric("abc") is None

    def test_none(self):
        assert _to_numeric(None) is None

    def test_list(self):
        assert _to_numeric([1, 2]) is None


# ─── _to_list ─────────────────────────────────────────────────────────────────

class TestToList:
    def test_list_of_strings(self):
        assert _to_list(["Family_Ties", "property"]) == ["family_ties", "property"]

    def test_comma_separated_string(self):
        assert _to_list("family_ties,property_or_assets") == ["family_ties", "property_or_assets"]

    def test_single_string(self):
        assert _to_list("property_or_assets") == ["property_or_assets"]

    def test_empty_string(self):
        assert _to_list("") == []

    def test_none(self):
        assert _to_list(None) == []

    def test_empty_list(self):
        assert _to_list([]) == []

    def test_whitespace_items_stripped(self):
        result = _to_list(["  yes  ", "  no  "])
        assert result == ["yes", "no"]


# ─── evaluate_condition — 'any' ───────────────────────────────────────────────

class TestConditionAny:
    def test_passes_yes(self):
        assert evaluate_condition({"type": "any"}, "yes") is True

    def test_passes_no(self):
        # 'any' passes regardless of value — it's informational
        assert evaluate_condition({"type": "any"}, "no") is True

    def test_passes_arbitrary_string(self):
        assert evaluate_condition({"type": "any"}, "ontario") is True

    def test_passes_numeric_zero(self):
        # 0 is not None and not "" — passes
        assert evaluate_condition({"type": "any"}, 0) is True

    def test_passes_string_zero(self):
        assert evaluate_condition({"type": "any"}, "0") is True

    def test_passes_nonempty_list(self):
        assert evaluate_condition({"type": "any"}, ["family_ties"]) is True

    def test_fails_none(self):
        assert evaluate_condition({"type": "any"}, None) is False

    def test_fails_empty_string(self):
        assert evaluate_condition({"type": "any"}, "") is False

    def test_fails_empty_list(self):
        assert evaluate_condition({"type": "any"}, []) is False


# ─── evaluate_condition — 'never' ────────────────────────────────────────────

class TestConditionNever:
    def test_always_false_on_yes(self):
        assert evaluate_condition({"type": "never"}, "yes") is False

    def test_always_false_on_no(self):
        assert evaluate_condition({"type": "never"}, "no") is False

    def test_always_false_on_none(self):
        assert evaluate_condition({"type": "never"}, None) is False

    def test_always_false_on_empty(self):
        assert evaluate_condition({"type": "never"}, "") is False

    def test_always_false_on_nonempty(self):
        assert evaluate_condition({"type": "never"}, "anything") is False


# ─── evaluate_condition — 'eq' ────────────────────────────────────────────────

class TestConditionEq:
    def test_match(self):
        assert evaluate_condition({"type": "eq", "value": "yes"}, "yes") is True

    def test_no_match(self):
        assert evaluate_condition({"type": "eq", "value": "yes"}, "no") is False

    def test_case_insensitive(self):
        assert evaluate_condition({"type": "eq", "value": "yes"}, "YES") is True

    def test_whitespace_stripped(self):
        assert evaluate_condition({"type": "eq", "value": "yes"}, " yes ") is True

    def test_none_answer(self):
        assert evaluate_condition({"type": "eq", "value": "yes"}, None) is False

    def test_empty_answer(self):
        assert evaluate_condition({"type": "eq", "value": "yes"}, "") is False

    def test_unknown_not_matching_yes(self):
        assert evaluate_condition({"type": "eq", "value": "yes"}, "unknown") is False

    def test_missing_value_key(self):
        # Malformed: no 'value' in condition
        assert evaluate_condition({"type": "eq"}, "yes") is False


# ─── evaluate_condition — 'neq' ───────────────────────────────────────────────

class TestConditionNeq:
    def test_passes_different_value(self):
        assert evaluate_condition({"type": "neq", "value": "no"}, "yes") is True

    def test_fails_same_value(self):
        assert evaluate_condition({"type": "neq", "value": "no"}, "no") is False

    def test_case_insensitive(self):
        assert evaluate_condition({"type": "neq", "value": "no"}, "NO") is False

    def test_none_answer(self):
        assert evaluate_condition({"type": "neq", "value": "no"}, None) is False


# ─── evaluate_condition — 'in' ────────────────────────────────────────────────

class TestConditionIn:
    def test_matches_first_value(self):
        cond = {"type": "in", "value": ["yes", "not_applicable"]}
        assert evaluate_condition(cond, "yes") is True

    def test_matches_second_value(self):
        cond = {"type": "in", "value": ["yes", "not_applicable"]}
        assert evaluate_condition(cond, "not_applicable") is True

    def test_no_match(self):
        cond = {"type": "in", "value": ["yes", "not_applicable"]}
        assert evaluate_condition(cond, "no") is False

    def test_unknown_not_in_list(self):
        cond = {"type": "in", "value": ["yes", "not_applicable"]}
        assert evaluate_condition(cond, "unknown") is False

    def test_case_insensitive(self):
        cond = {"type": "in", "value": ["yes", "not_applicable"]}
        assert evaluate_condition(cond, "YES") is True

    def test_none_answer(self):
        cond = {"type": "in", "value": ["yes", "not_applicable"]}
        assert evaluate_condition(cond, None) is False

    def test_malformed_value_not_list(self):
        # 'value' must be a list for 'in'
        cond = {"type": "in", "value": "yes"}
        assert evaluate_condition(cond, "yes") is False


# ─── evaluate_condition — 'not_in' ───────────────────────────────────────────

class TestConditionNotIn:
    def test_passes_unlisted_value(self):
        cond = {"type": "not_in", "value": ["no", "unknown"]}
        assert evaluate_condition(cond, "yes") is True

    def test_fails_listed_value(self):
        cond = {"type": "not_in", "value": ["no", "unknown"]}
        assert evaluate_condition(cond, "no") is False

    def test_fails_other_listed_value(self):
        cond = {"type": "not_in", "value": ["no", "unknown"]}
        assert evaluate_condition(cond, "unknown") is False

    def test_case_insensitive(self):
        cond = {"type": "not_in", "value": ["no", "unknown"]}
        assert evaluate_condition(cond, "NO") is False

    def test_none_answer(self):
        cond = {"type": "not_in", "value": ["no", "unknown"]}
        assert evaluate_condition(cond, None) is False


# ─── evaluate_condition — 'gte' ───────────────────────────────────────────────

class TestConditionGte:
    def test_exact_boundary_passes(self):
        assert evaluate_condition({"type": "gte", "value": 18}, 18) is True

    def test_above_threshold_passes(self):
        assert evaluate_condition({"type": "gte", "value": 18}, 25) is True

    def test_below_threshold_fails(self):
        assert evaluate_condition({"type": "gte", "value": 18}, 17) is False

    def test_numeric_string_passes(self):
        assert evaluate_condition({"type": "gte", "value": 18}, "25") is True

    def test_numeric_string_fails(self):
        assert evaluate_condition({"type": "gte", "value": 18}, "16") is False

    def test_currency_string_with_comma(self):
        # "29,710" should be treated as 29710
        assert evaluate_condition({"type": "gte", "value": 29710}, "29,710") is True

    def test_currency_string_below_threshold(self):
        assert evaluate_condition({"type": "gte", "value": 29710}, "15,000") is False

    def test_non_numeric_string_fails(self):
        assert evaluate_condition({"type": "gte", "value": 18}, "not_a_number") is False

    def test_none_answer(self):
        assert evaluate_condition({"type": "gte", "value": 18}, None) is False

    def test_zero_answer_below_threshold(self):
        assert evaluate_condition({"type": "gte", "value": 1}, 0) is False

    def test_large_living_cost_threshold(self):
        # Australia living cost AUD 29,710
        assert evaluate_condition({"type": "gte", "value": 29710}, 30000) is True
        assert evaluate_condition({"type": "gte", "value": 29710}, 29709) is False


# ─── evaluate_condition — 'gt' ────────────────────────────────────────────────

class TestConditionGt:
    def test_strictly_above_passes(self):
        assert evaluate_condition({"type": "gt", "value": 0}, "1") is True

    def test_exact_boundary_fails(self):
        # strict: equal does NOT pass
        assert evaluate_condition({"type": "gt", "value": 0}, "0") is False

    def test_below_fails(self):
        assert evaluate_condition({"type": "gt", "value": 5}, "3") is False

    def test_none_answer(self):
        assert evaluate_condition({"type": "gt", "value": 0}, None) is False


# ─── evaluate_condition — 'lte' ───────────────────────────────────────────────

class TestConditionLte:
    def test_exact_boundary_passes(self):
        assert evaluate_condition({"type": "lte", "value": 100}, "100") is True

    def test_below_boundary_passes(self):
        assert evaluate_condition({"type": "lte", "value": 100}, "99") is True

    def test_above_boundary_fails(self):
        assert evaluate_condition({"type": "lte", "value": 100}, "101") is False


# ─── evaluate_condition — 'lt' ────────────────────────────────────────────────

class TestConditionLt:
    def test_strictly_below_passes(self):
        assert evaluate_condition({"type": "lt", "value": 100}, "99") is True

    def test_exact_boundary_fails(self):
        assert evaluate_condition({"type": "lt", "value": 100}, "100") is False

    def test_above_fails(self):
        assert evaluate_condition({"type": "lt", "value": 100}, "101") is False


# ─── evaluate_condition — 'multi_has_any' ────────────────────────────────────

class TestConditionMultiHasAny:
    def test_list_answer_with_match(self):
        cond = {"type": "multi_has_any", "value": ["property_or_assets", "employment_or_business"]}
        assert evaluate_condition(cond, ["family_ties", "property_or_assets"]) is True

    def test_list_answer_no_match(self):
        cond = {"type": "multi_has_any", "value": ["property_or_assets", "employment_or_business"]}
        assert evaluate_condition(cond, ["family_ties"]) is False

    def test_single_string_answer_matches(self):
        cond = {"type": "multi_has_any", "value": ["property_or_assets"]}
        assert evaluate_condition(cond, "property_or_assets") is True

    def test_single_string_answer_no_match(self):
        cond = {"type": "multi_has_any", "value": ["property_or_assets"]}
        assert evaluate_condition(cond, "family_ties") is False

    def test_comma_separated_string_matches(self):
        cond = {"type": "multi_has_any", "value": ["property_or_assets", "employment_or_business"]}
        assert evaluate_condition(cond, "family_ties,property_or_assets") is True

    def test_none_answer_fails(self):
        cond = {"type": "multi_has_any", "value": ["property_or_assets"]}
        assert evaluate_condition(cond, None) is False

    def test_empty_list_fails(self):
        cond = {"type": "multi_has_any", "value": ["property_or_assets"]}
        assert evaluate_condition(cond, []) is False

    def test_case_insensitive(self):
        cond = {"type": "multi_has_any", "value": ["property_or_assets"]}
        assert evaluate_condition(cond, ["PROPERTY_OR_ASSETS"]) is True

    def test_malformed_value_not_list(self):
        # 'value' must be a list for multi_has_any
        cond = {"type": "multi_has_any", "value": "property_or_assets"}
        assert evaluate_condition(cond, ["property_or_assets"]) is False

    def test_none_sentinel_not_in_pass_list(self):
        # "none" selected alone → fails multi_has_any (correct behaviour)
        cond = {"type": "multi_has_any", "value": ["property_or_assets", "family_ties"]}
        assert evaluate_condition(cond, ["none"]) is False


# ─── evaluate_condition — edge / safety ──────────────────────────────────────

class TestConditionEdgeCases:
    def test_none_condition_returns_false(self):
        assert evaluate_condition(None, "yes") is False

    def test_empty_dict_condition_returns_false(self):
        assert evaluate_condition({}, "yes") is False

    def test_missing_type_key_returns_false(self):
        assert evaluate_condition({"value": "yes"}, "yes") is False

    def test_unknown_type_returns_false(self):
        assert evaluate_condition({"type": "invented_type", "value": "x"}, "x") is False

    def test_computed_funds_ok_returns_false(self):
        # computed_* types are deferred — must return False, not crash
        assert evaluate_condition({"type": "computed_funds_ok"}, "50000") is False

    def test_computed_funds_short_returns_false(self):
        assert evaluate_condition({"type": "computed_funds_short"}, "5000") is False

    def test_computed_living_ok_returns_false(self):
        assert evaluate_condition({"type": "computed_living_ok"}, "30000") is False

    def test_computed_total_short_returns_false(self):
        assert evaluate_condition({"type": "computed_total_short"}, "1000") is False

    def test_non_dict_condition_returns_false(self):
        assert evaluate_condition("eq", "yes") is False  # type: ignore

    def test_list_condition_returns_false(self):
        assert evaluate_condition(["eq", "yes"], "yes") is False  # type: ignore

    def test_all_answers_param_accepted(self):
        # all_answers is accepted for future use — must not affect result
        cond = {"type": "eq", "value": "yes"}
        result = evaluate_condition(cond, "yes", all_answers={"other_q": "no"})
        assert result is True


# ─── _is_passing — canonical validation.pass_if ──────────────────────────────

class TestIsPassingValidationObject:
    """_is_passing() reads from question["validation"]["pass_if"]."""

    def test_eq_passes(self):
        q = {"id": "aus_has_coe", "validation": {"pass_if": {"type": "eq", "value": "yes"}}}
        assert _is_passing("yes", q) is True

    def test_eq_fails(self):
        q = {"id": "aus_has_coe", "validation": {"pass_if": {"type": "eq", "value": "yes"}}}
        assert _is_passing("no", q) is False

    def test_any_always_passes_for_any_value(self):
        q = {"id": "aus_funds_source", "validation": {"pass_if": {"type": "any"}}}
        for answer in ("savings", "property_sale", "family_gift", "bank_loan_sanctioned"):
            assert _is_passing(answer, q) is True, f"Expected pass for answer={answer!r}"

    def test_in_passes_for_listed_values(self):
        q = {
            "id": "aus_sponsor_immediate_family",
            "validation": {"pass_if": {"type": "in", "value": ["yes", "not_applicable"]}},
        }
        assert _is_passing("yes", q) is True
        assert _is_passing("not_applicable", q) is True

    def test_in_fails_for_unlisted_value(self):
        q = {
            "id": "aus_sponsor_immediate_family",
            "validation": {"pass_if": {"type": "in", "value": ["yes", "not_applicable"]}},
        }
        assert _is_passing("no", q) is False

    def test_gte_passes_at_threshold(self):
        q = {"id": "aus_applicant_age", "validation": {"pass_if": {"type": "gte", "value": 6}}}
        assert _is_passing("6", q) is True
        assert _is_passing("25", q) is True

    def test_gte_fails_below_threshold(self):
        q = {"id": "aus_applicant_age", "validation": {"pass_if": {"type": "gte", "value": 6}}}
        assert _is_passing("5", q) is False

    def test_multi_has_any_passes_with_match(self):
        q = {
            "id": "can_home_country_ties",
            "validation": {
                "pass_if": {
                    "type": "multi_has_any",
                    "value": ["property_or_assets", "employment_or_business", "family_ties"],
                }
            },
        }
        assert _is_passing(["family_ties", "property_or_assets"], q) is True

    def test_multi_has_any_fails_with_only_none(self):
        q = {
            "id": "can_home_country_ties",
            "validation": {
                "pass_if": {
                    "type": "multi_has_any",
                    "value": ["property_or_assets", "employment_or_business"],
                }
            },
        }
        assert _is_passing(["none"], q) is False

    def test_never_always_fails(self):
        q = {"id": "info_q", "validation": {"pass_if": {"type": "never"}}}
        assert _is_passing("yes", q) is False

    def test_none_answer_always_fails(self):
        q = {"id": "q1", "validation": {"pass_if": {"type": "eq", "value": "yes"}}}
        assert _is_passing(None, q) is False

    def test_empty_answer_always_fails_even_for_any(self):
        q = {"id": "q1", "validation": {"pass_if": {"type": "any"}}}
        assert _is_passing("", q) is False


# ─── _is_passing — flat pass_if (UK / legacy compat) ─────────────────────────

class TestIsPassingFlatPassIf:
    """_is_passing() reads from question["pass_if"] directly when no validation key."""

    def test_flat_eq_passes(self):
        q = {
            "id": "uk_has_cas",
            "pass_if": {"type": "eq", "value": "yes"},
            # deliberately no "validation" key
        }
        assert _is_passing("yes", q) is True

    def test_flat_eq_fails(self):
        q = {"id": "uk_has_cas", "pass_if": {"type": "eq", "value": "yes"}}
        assert _is_passing("no", q) is False

    def test_flat_in_passes(self):
        q = {
            "id": "uk_funds_held_28_days",
            "pass_if": {"type": "in", "value": ["yes", "not_applicable"]},
        }
        assert _is_passing("not_applicable", q) is True
        assert _is_passing("yes", q) is True

    def test_flat_in_fails(self):
        q = {
            "id": "uk_funds_held_28_days",
            "pass_if": {"type": "in", "value": ["yes", "not_applicable"]},
        }
        assert _is_passing("no", q) is False

    def test_flat_any_passes_all_non_empty(self):
        q = {"id": "uk_course_location", "pass_if": {"type": "any"}}
        assert _is_passing("london", q) is True
        assert _is_passing("outside_london", q) is True

    def test_flat_never_always_fails(self):
        q = {"id": "uk_info_field", "pass_if": {"type": "never"}}
        assert _is_passing("some value", q) is False

    def test_flat_gte_passes(self):
        q = {"id": "uk_maintenance_amount", "pass_if": {"type": "gte", "value": 1334}}
        assert _is_passing("1334", q) is True
        assert _is_passing("2000", q) is True

    def test_flat_gte_fails(self):
        q = {"id": "uk_maintenance_amount", "pass_if": {"type": "gte", "value": 1334}}
        assert _is_passing("1000", q) is False


# ─── _is_passing — priority: validation.pass_if beats flat pass_if ───────────

class TestIsPassingPriority:
    def test_validation_wins_over_flat(self):
        """
        When both exist, validation.pass_if takes priority.
        Here validation requires "yes", flat would accept anything.
        Answer "no" should fail even though flat would pass it.
        """
        q = {
            "id": "conflict_q",
            "validation": {"pass_if": {"type": "eq", "value": "yes"}},
            "pass_if": {"type": "any"},  # flat would pass "no"
        }
        assert _is_passing("yes", q) is True   # passes per validation
        assert _is_passing("no", q) is False   # fails per validation (not flat)

    def test_validation_none_falls_through_to_flat(self):
        """
        If validation exists but pass_if inside is absent, fall through to flat.
        """
        q = {
            "id": "q1",
            "validation": {"trigger_if": {"type": "eq", "value": "no"}},  # no pass_if key
            "pass_if": {"type": "eq", "value": "yes"},
        }
        assert _is_passing("yes", q) is True
        assert _is_passing("no", q) is False


# ─── _is_passing — no pass_if defined ────────────────────────────────────────

class TestIsPassingNoDefined:
    def test_no_validation_no_flat_returns_false(self):
        """Conservative fallback: no credit for undefined pass logic."""
        q = {"id": "q1", "input_type": "yes_no"}
        assert _is_passing("yes", q) is False

    def test_empty_validation_object_returns_false(self):
        q = {"id": "q1", "validation": {}}
        assert _is_passing("yes", q) is False

    def test_none_question_field_returns_false(self):
        q = {"id": "q1", "validation": None}
        assert _is_passing("yes", q) is False


# ─── _get_pass_if — resolver ──────────────────────────────────────────────────

class TestGetPassIf:
    def test_returns_nested_pass_if(self):
        q = {"validation": {"pass_if": {"type": "eq", "value": "yes"}}}
        result = _get_pass_if(q)
        assert result == {"type": "eq", "value": "yes"}

    def test_returns_flat_pass_if_when_no_validation(self):
        q = {"pass_if": {"type": "any"}}
        assert _get_pass_if(q) == {"type": "any"}

    def test_nested_wins_over_flat(self):
        q = {
            "validation": {"pass_if": {"type": "eq", "value": "yes"}},
            "pass_if": {"type": "any"},
        }
        result = _get_pass_if(q)
        assert result == {"type": "eq", "value": "yes"}

    def test_returns_none_when_neither_defined(self):
        q = {"id": "q1"}
        assert _get_pass_if(q) is None

    def test_returns_none_when_validation_has_no_pass_if(self):
        q = {"validation": {"trigger_if": {"type": "eq", "value": "no"}}}
        assert _get_pass_if(q) is None

    def test_ignores_non_dict_validation(self):
        q = {"validation": "not_a_dict", "pass_if": {"type": "any"}}
        assert _get_pass_if(q) == {"type": "any"}

    def test_ignores_non_dict_nested_pass_if(self):
        # validation exists but pass_if inside is a string, not a dict
        q = {"validation": {"pass_if": "eq:yes"}, "pass_if": {"type": "any"}}
        assert _get_pass_if(q) == {"type": "any"}


# ===========================================================================
# Phase 1B Tests
# ===========================================================================

from services.readiness_engine import (
    evaluate,
    _apply_band_cap,
    _second_lowest_band,
    _evaluate_computed_trigger,
    _compute_financial_threshold,
    _conditional_satisfied,
)

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

BANDS = [
    {"min": 85, "max": 100, "label": "Strong Readiness",              "description": "Strong file."},
    {"min": 70, "max": 84,  "label": "Moderate Risk",                 "description": "Moderate risk."},
    {"min": 50, "max": 69,  "label": "High Refusal Risk",             "description": "High risk."},
    {"min": 0,  "max": 49,  "label": "Critical Refusal Risk",         "description": "Critical."},
]

def _make_scoring(blockers=None, flags=None, config=None, bands=None, categories=None):
    return {
        "score_bands":        bands or BANDS,
        "scoring_categories": categories or [],
        "critical_blockers_hard": blockers or [],
        "high_risk_flags":    flags or [],
        "config":             config or {},
    }

def _make_question(qid, pass_if_type="eq", pass_if_value="yes",
                   required=True, risk="High", help_text="Fix this.",
                   score_impact=5):
    return {
        "id": qid,
        "question": "Some question?",
        "help_text": help_text,
        "input_type": "yes_no",
        "required": required,
        "risk_category": risk,
        "mapped_rule": "Some rule",
        "mapped_rule_id": qid + "_rule",
        "source_url": "https://example.com",
        "score_impact": score_impact,
        "validation": {
            "pass_if":    {"type": pass_if_type, "value": pass_if_value},
            "trigger_if": {"type": "eq", "value": "no"},
        },
    }

def _make_blocker(qid, trigger_type="eq", trigger_value="no",
                  conditional_on=None, message="Hard stop."):
    b = {
        "question_id": qid,
        "trigger_if": {"type": trigger_type, "value": trigger_value},
        "mapped_rule": "A rule",
        "conditional_on": conditional_on,
        "message": message,
    }
    if trigger_type.startswith("computed"):
        b["trigger_if"] = {"type": trigger_type}
    return b

def _make_flag(qid, trigger_type="in", trigger_value=None,
               conditional_on=None, message="High risk."):
    return {
        "question_id": qid,
        "trigger_if": {"type": trigger_type, "value": trigger_value or ["no", "unknown"]},
        "mapped_rule": "A rule",
        "conditional_on": conditional_on,
        "message": message,
    }


# ---------------------------------------------------------------------------
# critical_blockers_hard key
# ---------------------------------------------------------------------------

class TestBlockerKeyFix:
    """Blockers must be read from critical_blockers_hard, not critical_blockers."""

    def test_old_key_is_ignored(self):
        """Scoring with only the old key produces no blockers."""
        scoring = {
            "score_bands": BANDS,
            "scoring_categories": [],
            "critical_blockers": [_make_blocker("q1")],  # OLD key
            "high_risk_flags": [],
            "config": {},
        }
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert result["critical_blockers"] == []

    def test_new_key_fires_blocker(self):
        """Scoring with critical_blockers_hard fires the blocker."""
        scoring = _make_scoring(blockers=[_make_blocker("q1")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert len(result["critical_blockers"]) == 1
        assert result["critical_blockers"][0]["question_id"] == "q1"

    def test_score_is_zero_on_blocker(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert result["score"] == 0

    def test_result_is_lowest_band_on_blocker(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert result["result"] == "Critical Refusal Risk"


# ---------------------------------------------------------------------------
# trigger_if eq
# ---------------------------------------------------------------------------

class TestBlockerTriggerEq:
    def test_eq_fires_on_matching_answer(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1", "eq", "no")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert len(result["critical_blockers"]) == 1

    def test_eq_does_not_fire_on_non_matching(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1", "eq", "no")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "yes"})
        assert result["critical_blockers"] == []

    def test_eq_case_insensitive(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1", "eq", "no")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "NO"})
        assert len(result["critical_blockers"]) == 1

    def test_eq_missing_answer_does_not_fire(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1", "eq", "no")])
        qs = [_make_question("q1", required=False)]
        result = evaluate(qs, scoring, {})
        assert result["critical_blockers"] == []


# ---------------------------------------------------------------------------
# trigger_if in
# ---------------------------------------------------------------------------

class TestBlockerTriggerIn:
    def test_in_fires_on_first_value(self):
        scoring = _make_scoring(
            blockers=[_make_blocker("q1", "in", ["no", "unknown"])])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert len(result["critical_blockers"]) == 1

    def test_in_fires_on_second_value(self):
        scoring = _make_scoring(
            blockers=[_make_blocker("q1", "in", ["no", "unknown"])])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "unknown"})
        assert len(result["critical_blockers"]) == 1

    def test_in_does_not_fire_on_unlisted(self):
        scoring = _make_scoring(
            blockers=[_make_blocker("q1", "in", ["no", "unknown"])])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "yes"})
        assert result["critical_blockers"] == []

    def test_in_case_insensitive(self):
        scoring = _make_scoring(
            blockers=[_make_blocker("q1", "in", ["no", "unknown"])])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "NO"})
        assert len(result["critical_blockers"]) == 1


# ---------------------------------------------------------------------------
# trigger_if never
# ---------------------------------------------------------------------------

class TestBlockerTriggerNever:
    def test_never_does_not_fire_on_any_answer(self):
        scoring = _make_scoring(
            blockers=[_make_blocker("q1", "never", None)])
        qs = [_make_question("q1")]
        for answer in ("yes", "no", "unknown", "anything"):
            result = evaluate(qs, scoring, {"q1": answer})
            assert result["critical_blockers"] == [], f"fired on answer={answer!r}"

    def test_never_does_not_fire_on_missing_answer(self):
        scoring = _make_scoring(
            blockers=[_make_blocker("q1", "never", None)])
        qs = [_make_question("q1", required=False)]
        result = evaluate(qs, scoring, {})
        assert result["critical_blockers"] == []


# ---------------------------------------------------------------------------
# Blocker enrichment
# ---------------------------------------------------------------------------

class TestBlockerEnrichment:
    def test_blocker_includes_question_id(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert result["critical_blockers"][0]["question_id"] == "q1"

    def test_blocker_includes_message(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1", message="Fix your CoE.")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert result["critical_blockers"][0]["message"] == "Fix your CoE."

    def test_blocker_includes_rule(self):
        b = _make_blocker("q1")
        b["mapped_rule"] = "CoE Required"
        scoring = _make_scoring(blockers=[b])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert result["critical_blockers"][0]["rule"] == "CoE Required"

    def test_blocker_includes_rule_id_from_question(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert result["critical_blockers"][0]["rule_id"] == "q1_rule"

    def test_blocker_includes_source_url_from_question(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert result["critical_blockers"][0]["source_url"] == "https://example.com"

    def test_blocker_includes_severity_from_question(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1")])
        qs = [_make_question("q1", risk="Critical")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert result["critical_blockers"][0]["severity"] == "Critical"


# ---------------------------------------------------------------------------
# conditional_on
# ---------------------------------------------------------------------------

class TestConditionalOn:
    def test_blocker_skipped_when_condition_not_met(self):
        """Blocker on q1 fires only when q_parent=yes. If q_parent=no, skip."""
        blocker = _make_blocker(
            "q1",
            conditional_on={"question_id": "q_parent", "operator": "eq", "value": "yes"}
        )
        scoring = _make_scoring(blockers=[blocker])
        qs = [_make_question("q1"), _make_question("q_parent")]
        # q_parent = no -> condition not met -> blocker skipped
        result = evaluate(qs, scoring, {"q1": "no", "q_parent": "no"})
        assert result["critical_blockers"] == []

    def test_blocker_fires_when_condition_met(self):
        blocker = _make_blocker(
            "q1",
            conditional_on={"question_id": "q_parent", "operator": "eq", "value": "yes"}
        )
        scoring = _make_scoring(blockers=[blocker])
        qs = [_make_question("q1"), _make_question("q_parent")]
        result = evaluate(qs, scoring, {"q1": "no", "q_parent": "yes"})
        assert len(result["critical_blockers"]) == 1

    def test_none_conditional_on_always_evaluates(self):
        blocker = _make_blocker("q1", conditional_on=None)
        scoring = _make_scoring(blockers=[blocker])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert len(result["critical_blockers"]) == 1


# ---------------------------------------------------------------------------
# High-risk flag evaluation
# ---------------------------------------------------------------------------

class TestHighRiskFlags:
    def test_flag_returned_when_triggered(self):
        scoring = _make_scoring(flags=[_make_flag("q1")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert len(result["high_risk_flags"]) == 1
        assert result["high_risk_flags"][0]["question_id"] == "q1"

    def test_flag_not_returned_when_not_triggered(self):
        scoring = _make_scoring(flags=[_make_flag("q1")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "yes"})
        assert result["high_risk_flags"] == []

    def test_flag_not_returned_when_answer_missing(self):
        scoring = _make_scoring(flags=[_make_flag("q1")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {})
        assert result["high_risk_flags"] == []

    def test_multiple_flags_all_returned(self):
        scoring = _make_scoring(flags=[
            _make_flag("q1"), _make_flag("q2"), _make_flag("q3")
        ])
        qs = [_make_question("q1"), _make_question("q2"), _make_question("q3")]
        result = evaluate(qs, scoring, {"q1": "no", "q2": "unknown", "q3": "no"})
        assert len(result["high_risk_flags"]) == 3


# ---------------------------------------------------------------------------
# Band capping
# ---------------------------------------------------------------------------

class TestBandCap:
    def test_zero_flags_no_cap(self):
        band = {"min": 85, "max": 100, "label": "Strong Readiness", "description": ""}
        result = _apply_band_cap(band, 0, BANDS)
        assert result["label"] == "Strong Readiness"

    def test_one_flag_caps_at_high(self):
        band = {"min": 85, "max": 100, "label": "Strong Readiness", "description": ""}
        result = _apply_band_cap(band, 1, BANDS)
        assert result["label"] == "High Refusal Risk"

    def test_two_flags_caps_at_high(self):
        band = {"min": 85, "max": 100, "label": "Strong Readiness", "description": ""}
        result = _apply_band_cap(band, 2, BANDS)
        assert result["label"] == "High Refusal Risk"

    def test_three_flags_caps_at_critical(self):
        band = {"min": 85, "max": 100, "label": "Strong Readiness", "description": ""}
        result = _apply_band_cap(band, 3, BANDS)
        assert result["label"] == "Critical Refusal Risk"

    def test_four_flags_caps_at_critical(self):
        band = {"min": 70, "max": 84, "label": "Moderate Risk", "description": ""}
        result = _apply_band_cap(band, 4, BANDS)
        assert result["label"] == "Critical Refusal Risk"

    def test_cap_does_not_upgrade_band(self):
        """If already at High Refusal Risk, 1-2 flags don't change it."""
        band = {"min": 50, "max": 69, "label": "High Refusal Risk", "description": ""}
        result = _apply_band_cap(band, 1, BANDS)
        assert result["label"] == "High Refusal Risk"

    def test_cap_does_not_upgrade_critical(self):
        band = {"min": 0, "max": 49, "label": "Critical Refusal Risk", "description": ""}
        result = _apply_band_cap(band, 3, BANDS)
        assert result["label"] == "Critical Refusal Risk"


class TestBandCapEndToEnd:
    """Full evaluate() calls to verify band capping with 1B engine."""

    def _scoring_with_flags(self, flag_count, score_answers=None):
        """
        Build a scoring with N high_risk_flags all pointing at qN questions.
        A single scoring category awards 90 points so the raw score is high.
        """
        qids = ["hrf_q{}".format(i) for i in range(flag_count)]
        flags = [_make_flag(qid) for qid in qids]

        # One scored question that always passes -> high score
        scored_qid = "scored_q"
        category = {
            "category_id": "cat",
            "label": "Cat",
            "max_points": 90,
            "question_ids": [scored_qid],
        }
        return (
            _make_scoring(flags=flags, categories=[category]),
            [_make_question(q) for q in qids] + [_make_question(scored_qid, pass_if_type="any")],
            {scored_qid: "yes", **{q: "no" for q in qids}},
        )

    def test_high_score_with_one_flag_is_capped_at_high(self):
        scoring, qs, answers = self._scoring_with_flags(1)
        result = evaluate(qs, scoring, answers)
        assert result["score"] >= 85  # raw score is high
        assert result["result"] == "High Refusal Risk"

    def test_high_score_with_three_flags_is_capped_at_critical(self):
        scoring, qs, answers = self._scoring_with_flags(3)
        result = evaluate(qs, scoring, answers)
        assert result["score"] >= 85
        assert result["result"] == "Critical Refusal Risk"

    def test_zero_flags_high_score_is_not_capped(self):
        scoring, qs, answers = self._scoring_with_flags(0)
        result = evaluate(qs, scoring, answers)
        assert result["result"] == "Strong Readiness"


# ---------------------------------------------------------------------------
# Blocker overrides band
# ---------------------------------------------------------------------------

class TestBlockerOverride:
    def test_blocker_forces_score_zero(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert result["score"] == 0

    def test_blocker_forces_critical_band(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert result["result"] == "Critical Refusal Risk"

    def test_blocker_empty_high_risk_flags(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "no"})
        assert result["high_risk_flags"] == []

    def test_clean_answers_no_blocker_no_critical(self):
        scoring = _make_scoring(blockers=[_make_blocker("q1")])
        qs = [_make_question("q1")]
        result = evaluate(qs, scoring, {"q1": "yes"})
        assert result["critical_blockers"] == []
        assert result["score"] == 0  # no scoring categories defined


# ---------------------------------------------------------------------------
# Computed triggers
# ---------------------------------------------------------------------------

class TestComputedTrigger:
    def test_computed_funds_short_triggers_when_below(self):
        config = {"living_cost_single_12m": 29710, "return_airfare_estimate": 2500}
        # answer=5000, threshold=0+29710+2500=32210 -> short
        result = _evaluate_computed_trigger("computed_funds_short", "5000", {}, config)
        assert result is True

    def test_computed_funds_short_does_not_trigger_when_above(self):
        config = {"living_cost_single_12m": 29710, "return_airfare_estimate": 2500}
        result = _evaluate_computed_trigger("computed_funds_short", "50000", {}, config)
        assert result is False

    def test_computed_funds_short_includes_tuition(self):
        config = {"living_cost_single_12m": 29710, "return_airfare_estimate": 2500}
        answers = {"aus_tuition_first_year": "40000"}
        # threshold = 40000 + 29710 + 2500 = 72210
        assert _evaluate_computed_trigger("computed_funds_short", "72209", answers, config) is True
        assert _evaluate_computed_trigger("computed_funds_short", "72210", answers, config) is False

    def test_computed_living_short_triggers(self):
        config = {"living_cost_single_outside_quebec": 22895, "return_transport_estimate": 1500}
        result = _evaluate_computed_trigger("computed_living_short", "10000", {}, config)
        assert result is True

    def test_computed_living_short_does_not_trigger_above(self):
        config = {"living_cost_single_outside_quebec": 22895, "return_transport_estimate": 1500}
        result = _evaluate_computed_trigger("computed_living_short", "30000", {}, config)
        assert result is False

    def test_computed_total_short_triggers(self):
        config = {"living_cost_single_outside_quebec": 22895, "return_transport_estimate": 1500}
        answers = {"can_tuition_amount": "15000"}
        # threshold = 15000 + 22895 + 1500 = 39395
        assert _evaluate_computed_trigger("computed_total_short", "39394", answers, config) is True
        assert _evaluate_computed_trigger("computed_total_short", "39395", answers, config) is False

    def test_computed_missing_config_returns_false_no_crash(self):
        """Missing config must NOT crash -- returns False with a warning."""
        result = _evaluate_computed_trigger("computed_funds_short", "5000", {}, {})
        assert result is False

    def test_computed_non_numeric_answer_returns_false(self):
        config = {"living_cost_single_12m": 29710, "return_airfare_estimate": 2500}
        result = _evaluate_computed_trigger("computed_funds_short", "not_a_number", {}, config)
        assert result is False

    def test_computed_none_answer_returns_false(self):
        config = {"living_cost_single_12m": 29710, "return_airfare_estimate": 2500}
        result = _evaluate_computed_trigger("computed_funds_short", None, {}, config)
        assert result is False

    def test_computed_ok_in_trigger_if_returns_false(self):
        """_ok types should not appear in trigger_if -- safe no-op."""
        config = {"living_cost_single_12m": 29710, "return_airfare_estimate": 2500}
        result = _evaluate_computed_trigger("computed_funds_ok", "5000", {}, config)
        assert result is False

    def test_computed_blocker_in_evaluate_does_not_crash(self):
        """Full evaluate() with a computed_ blocker and missing config must not crash."""
        blocker = {
            "question_id": "q_funds",
            "trigger_if": {"type": "computed_funds_short"},
            "mapped_rule": "Funds",
            "conditional_on": None,
            "message": "Insufficient funds.",
        }
        scoring = _make_scoring(blockers=[blocker])
        q = _make_question("q_funds")
        q["input_type"] = "currency_amount"
        # No config -> threshold cannot be computed -> blocker does NOT fire
        result = evaluate([q], scoring, {"q_funds": "5000"})
        assert result["critical_blockers"] == []

    def test_computed_blocker_fires_with_valid_config(self):
        """Full evaluate() computed_ blocker fires when config is present."""
        blocker = {
            "question_id": "q_funds",
            "trigger_if": {"type": "computed_funds_short"},
            "mapped_rule": "Funds",
            "conditional_on": None,
            "message": "Insufficient funds.",
        }
        config = {"living_cost_single_12m": 29710, "return_airfare_estimate": 2500}
        scoring = _make_scoring(blockers=[blocker], config=config)
        q = _make_question("q_funds")
        q["input_type"] = "currency_amount"
        result = evaluate([q], scoring, {"q_funds": "1000"})
        assert len(result["critical_blockers"]) == 1
        assert result["score"] == 0


# ===========================================================================
# Phase 1C Tests — Explicit config-driven financial thresholds
# ===========================================================================

from services.readiness_engine import (
    _compute_financial_threshold,
    _threshold_aus,
    _threshold_uk,
    _threshold_can,
    _AUS_TUITION_QID,
    _AUS_DEPENDANT_QID,
    _UK_TUITION_QID,
    _UK_TUITION_PAID_QID,
    _UK_LOCATION_QID,
    _CAN_TUITION_QID,
    _CAN_QUEBEC_QID,
    _CAN_PROVINCE_QID,
)

# ---------------------------------------------------------------------------
# Shared config fixtures
# ---------------------------------------------------------------------------

AUS_CONFIG = {
    "living_cost_single_12m":  29710,
    "living_cost_partner_add": 10394,
    "living_cost_child_add":   4449,
    "return_airfare_estimate": 2500,
}

UK_CONFIG = {
    "maintenance_london_total":  13761,
    "maintenance_outside_total": 10539,
}

CAN_CONFIG = {
    "living_cost_single_outside_quebec": 22895,
    "quebec_single_adult":               24617,
    "return_transport_estimate":         1500,
}


# ---------------------------------------------------------------------------
# Explicit question IDs
# ---------------------------------------------------------------------------

class TestExplicitQuestionIDs:
    """Verify the module-level constants are correctly named -- a canary for renames."""

    def test_aus_tuition_qid(self):
        assert _AUS_TUITION_QID == "aus_tuition_first_year"

    def test_aus_dependant_qid(self):
        assert _AUS_DEPENDANT_QID == "aus_has_dependant_funds"

    def test_uk_tuition_qid(self):
        assert _UK_TUITION_QID == "uk_first_year_tuition_fee"

    def test_uk_tuition_paid_qid(self):
        assert _UK_TUITION_PAID_QID == "uk_tuition_fee_paid"

    def test_uk_location_qid(self):
        assert _UK_LOCATION_QID == "uk_course_location"

    def test_can_tuition_qid(self):
        assert _CAN_TUITION_QID == "can_tuition_amount"

    def test_can_quebec_qid(self):
        assert _CAN_QUEBEC_QID == "can_is_quebec_applicant"

    def test_can_province_qid(self):
        assert _CAN_PROVINCE_QID == "can_study_province"


# ---------------------------------------------------------------------------
# Australia threshold
# ---------------------------------------------------------------------------

class TestThresholdAus:
    """_threshold_aus / _compute_financial_threshold for AUS config."""

    def test_uses_explicit_tuition_qid(self):
        """Tuition must come from _AUS_TUITION_QID, not fuzzy scanning."""
        answers = {
            _AUS_TUITION_QID: "30000",          # correct key
            "some_other_tuition_field": "99999", # should be ignored
        }
        t = _threshold_aus("computed_funds_short", AUS_CONFIG, answers)
        # 30000 + 29710 + 2500 = 62210
        assert t == pytest.approx(62210.0)

    def test_wrong_key_is_not_used(self):
        """If answer uses a different key, tuition falls back to 0."""
        answers = {"tuition_amount_wrong": "30000"}  # not the right key
        t = _threshold_aus("computed_funds_short", AUS_CONFIG, answers)
        # 0 + 29710 + 2500 = 32210
        assert t == pytest.approx(32210.0)

    def test_missing_tuition_uses_zero_not_crash(self):
        t = _threshold_aus("computed_funds_short", AUS_CONFIG, {})
        assert t == pytest.approx(29710.0 + 2500.0)
        assert t is not None

    def test_nonnumeric_tuition_uses_zero_not_crash(self):
        answers = {_AUS_TUITION_QID: "not_a_number"}
        t = _threshold_aus("computed_funds_short", AUS_CONFIG, answers)
        assert t == pytest.approx(29710.0 + 2500.0)

    def test_no_dependants_not_applicable(self):
        answers = {
            _AUS_TUITION_QID: "25000",
            _AUS_DEPENDANT_QID: "not_applicable",
        }
        t = _threshold_aus("computed_funds_short", AUS_CONFIG, answers)
        # 25000 + 29710 + 2500 + 0 = 57210
        assert t == pytest.approx(57210.0)

    def test_dependant_yes_adds_partner_minimum(self):
        """Dependant present but count unknown -> adds living_cost_partner_add as minimum."""
        answers = {
            _AUS_TUITION_QID: "25000",
            _AUS_DEPENDANT_QID: "yes",
        }
        t = _threshold_aus("computed_funds_short", AUS_CONFIG, answers)
        # 25000 + 29710 + 2500 + 10394 = 67604
        assert t == pytest.approx(67604.0)

    def test_dependant_no_adds_partner_minimum(self):
        """'no' also indicates dependant present (just doesn't have funds)."""
        answers = {
            _AUS_TUITION_QID: "25000",
            _AUS_DEPENDANT_QID: "no",
        }
        t = _threshold_aus("computed_funds_short", AUS_CONFIG, answers)
        assert t == pytest.approx(67604.0)

    def test_absent_dependant_answer_means_no_dependants(self):
        answers = {_AUS_TUITION_QID: "25000"}
        t = _threshold_aus("computed_funds_short", AUS_CONFIG, answers)
        # 25000 + 29710 + 2500 + 0 = 57210
        assert t == pytest.approx(57210.0)

    def test_missing_partner_add_config_no_crash(self):
        """If living_cost_partner_add is absent, dependant addition is 0 (not crash)."""
        config = dict(AUS_CONFIG)
        del config["living_cost_partner_add"]
        answers = {
            _AUS_TUITION_QID: "25000",
            _AUS_DEPENDANT_QID: "yes",
        }
        t = _threshold_aus("computed_funds_short", config, answers)
        # 25000 + 29710 + 2500 + 0 = 57210
        assert t == pytest.approx(57210.0)

    def test_dispatch_from_compute_financial_threshold(self):
        """_compute_financial_threshold detects AUS by living_cost_single_12m."""
        answers = {_AUS_TUITION_QID: "20000"}
        t = _compute_financial_threshold("computed_funds_short", AUS_CONFIG, answers)
        assert t == pytest.approx(20000 + 29710 + 2500)

    def test_compute_funds_ok_same_threshold_as_short(self):
        answers = {_AUS_TUITION_QID: "20000"}
        t_short = _threshold_aus("computed_funds_short", AUS_CONFIG, answers)
        t_ok    = _threshold_aus("computed_funds_ok",    AUS_CONFIG, answers)
        assert t_short == t_ok

    def test_unexpected_type_returns_none(self):
        t = _threshold_aus("computed_living_short", AUS_CONFIG, {})
        assert t is None


# ---------------------------------------------------------------------------
# United Kingdom threshold
# ---------------------------------------------------------------------------

class TestThresholdUk:
    """_threshold_uk / _compute_financial_threshold for UK config."""

    def test_outside_london_no_tuition(self):
        """With no tuition answer: threshold = 0 + maintenance_outside_total."""
        t = _threshold_uk("computed_funds_short", UK_CONFIG, {})
        assert t == pytest.approx(10539.0)

    def test_london_no_tuition(self):
        t = _threshold_uk("computed_funds_short", UK_CONFIG,
                          {_UK_LOCATION_QID: "london"})
        assert t == pytest.approx(13761.0)

    def test_tuition_added_to_maintenance(self):
        answers = {
            _UK_TUITION_QID: "12000",
            _UK_LOCATION_QID: "outside_london",
        }
        t = _threshold_uk("computed_funds_short", UK_CONFIG, answers)
        # 12000 + 10539 = 22539
        assert t == pytest.approx(22539.0)

    def test_tuition_paid_reduces_net_tuition(self):
        """Formula: (tuition - paid) + maintenance."""
        answers = {
            _UK_TUITION_QID:      "12000",
            _UK_TUITION_PAID_QID: "4000",
            _UK_LOCATION_QID:     "outside_london",
        }
        t = _threshold_uk("computed_funds_short", UK_CONFIG, answers)
        # (12000 - 4000) + 10539 = 18539
        assert t == pytest.approx(18539.0)

    def test_paid_cannot_exceed_tuition(self):
        """If paid > tuition, net tuition is clamped to 0 (not negative)."""
        answers = {
            _UK_TUITION_QID:      "5000",
            _UK_TUITION_PAID_QID: "9000",  # more than tuition
            _UK_LOCATION_QID:     "outside_london",
        }
        t = _threshold_uk("computed_funds_short", UK_CONFIG, answers)
        # net = max(0, 5000-9000) = 0; threshold = 0 + 10539 = 10539
        assert t == pytest.approx(10539.0)

    def test_missing_tuition_uses_zero_not_crash(self):
        t = _threshold_uk("computed_funds_short", UK_CONFIG,
                          {_UK_LOCATION_QID: "london"})
        assert t == pytest.approx(13761.0)

    def test_nonnumeric_tuition_uses_zero_not_crash(self):
        answers = {
            _UK_TUITION_QID: "TBD",
            _UK_LOCATION_QID: "london",
        }
        t = _threshold_uk("computed_funds_short", UK_CONFIG, answers)
        assert t == pytest.approx(13761.0)

    def test_missing_maintenance_config_returns_none(self):
        t = _threshold_uk("computed_funds_short", {}, {})
        assert t is None

    def test_dispatch_from_compute_financial_threshold(self):
        """_compute_financial_threshold detects UK by maintenance_london_total."""
        answers = {_UK_TUITION_QID: "10000", _UK_LOCATION_QID: "london"}
        t = _compute_financial_threshold("computed_funds_short", UK_CONFIG, answers)
        assert t == pytest.approx(10000 + 13761)

    def test_unexpected_type_returns_none(self):
        t = _threshold_uk("computed_living_short", UK_CONFIG, {})
        assert t is None


# ---------------------------------------------------------------------------
# Canada threshold
# ---------------------------------------------------------------------------

class TestThresholdCan:
    """_threshold_can / _compute_financial_threshold for CAN config."""

    # --- Outside Quebec ---

    def test_outside_quebec_living(self):
        t = _threshold_can("computed_living_short", CAN_CONFIG, {})
        assert t == pytest.approx(22895.0)

    def test_outside_quebec_total_no_tuition(self):
        t = _threshold_can("computed_total_short", CAN_CONFIG, {})
        # 0 + 22895 + 1500 = 24395
        assert t == pytest.approx(24395.0)

    def test_outside_quebec_total_with_tuition(self):
        answers = {_CAN_TUITION_QID: "15000"}
        t = _threshold_can("computed_total_short", CAN_CONFIG, answers)
        # 15000 + 22895 + 1500 = 39395
        assert t == pytest.approx(39395.0)

    def test_uses_explicit_tuition_qid(self):
        """Only _CAN_TUITION_QID is used; fuzzy scanning is gone."""
        answers = {
            _CAN_TUITION_QID: "15000",
            "some_other_tuition": "99999",  # must be ignored
        }
        t = _threshold_can("computed_total_short", CAN_CONFIG, answers)
        assert t == pytest.approx(15000 + 22895 + 1500)

    def test_wrong_tuition_key_falls_back_to_zero(self):
        answers = {"wrong_key_tuition": "15000"}
        t = _threshold_can("computed_total_short", CAN_CONFIG, answers)
        assert t == pytest.approx(0 + 22895 + 1500)

    def test_missing_tuition_not_crash(self):
        t = _threshold_can("computed_total_short", CAN_CONFIG, {})
        assert t == pytest.approx(22895 + 1500)

    # --- Quebec via can_is_quebec_applicant ---

    def test_quebec_via_is_quebec_question(self):
        answers = {_CAN_QUEBEC_QID: "yes"}
        t = _threshold_can("computed_living_short", CAN_CONFIG, answers)
        assert t == pytest.approx(24617.0)

    def test_quebec_total_via_is_quebec_question(self):
        answers = {
            _CAN_QUEBEC_QID:  "yes",
            _CAN_TUITION_QID: "18000",
        }
        t = _threshold_can("computed_total_short", CAN_CONFIG, answers)
        # 18000 + 24617 + 1500 = 44117
        assert t == pytest.approx(44117.0)

    # --- Quebec via can_study_province ---

    def test_quebec_via_province_question(self):
        answers = {_CAN_PROVINCE_QID: "quebec"}
        t = _threshold_can("computed_living_short", CAN_CONFIG, answers)
        assert t == pytest.approx(24617.0)

    def test_non_quebec_province_uses_outside_threshold(self):
        answers = {_CAN_PROVINCE_QID: "ontario"}
        t = _threshold_can("computed_living_short", CAN_CONFIG, answers)
        assert t == pytest.approx(22895.0)

    # --- Quebec config missing ---

    def test_quebec_missing_config_returns_none_not_crash(self):
        """If quebec_single_adult key absent, must return None (not fall back silently)."""
        config = {k: v for k, v in CAN_CONFIG.items() if k != "quebec_single_adult"}
        answers = {_CAN_QUEBEC_QID: "yes"}
        t = _threshold_can("computed_living_short", config, answers)
        assert t is None

    def test_quebec_missing_config_propagates_none_from_dispatch(self):
        config = {k: v for k, v in CAN_CONFIG.items() if k != "quebec_single_adult"}
        answers = {_CAN_QUEBEC_QID: "yes"}
        t = _compute_financial_threshold("computed_living_short", config, answers)
        assert t is None

    def test_outside_quebec_missing_config_returns_none(self):
        config = {}  # missing living_cost_single_outside_quebec
        t = _threshold_can("computed_living_short", config, {})
        assert t is None

    # --- Dispatch ---

    def test_dispatch_from_compute_financial_threshold(self):
        """_compute_financial_threshold detects CAN by living_cost_single_outside_quebec."""
        answers = {_CAN_TUITION_QID: "10000"}
        t = _compute_financial_threshold("computed_total_short", CAN_CONFIG, answers)
        assert t == pytest.approx(10000 + 22895 + 1500)

    def test_unexpected_type_returns_none(self):
        t = _threshold_can("computed_funds_short", CAN_CONFIG, {})
        assert t is None


# ---------------------------------------------------------------------------
# Country dispatch -- unknown config
# ---------------------------------------------------------------------------

class TestComputeFinancialThresholdDispatch:
    def test_unknown_config_returns_none(self):
        """No recognised country key -> None (not crash)."""
        t = _compute_financial_threshold("computed_funds_short", {}, {})
        assert t is None

    def test_aus_detected_by_living_cost_key(self):
        t = _compute_financial_threshold("computed_funds_short", AUS_CONFIG, {})
        assert t is not None

    def test_uk_detected_by_maintenance_key(self):
        t = _compute_financial_threshold("computed_funds_short", UK_CONFIG, {})
        assert t is not None

    def test_can_detected_by_outside_quebec_key(self):
        t = _compute_financial_threshold("computed_living_short", CAN_CONFIG, {})
        assert t is not None


# ---------------------------------------------------------------------------
# Full evaluate() integration with 1C thresholds
# ---------------------------------------------------------------------------

class TestEvaluateComputedIntegration1C:
    """End-to-end evaluate() with real-ish computed blockers."""

    def _aus_scoring(self):
        blocker = {
            "question_id": "aus_available_funds",
            "trigger_if":  {"type": "computed_funds_short"},
            "mapped_rule": "Financial Capacity",
            "conditional_on": None,
            "message": "Insufficient funds.",
        }
        return {
            "score_bands": BANDS,
            "scoring_categories": [],
            "critical_blockers_hard": [blocker],
            "high_risk_flags": [],
            "config": AUS_CONFIG,
        }

    def _aus_question(self):
        q = _make_question("aus_available_funds", pass_if_type="any")
        q["input_type"] = "currency_amount"
        return q

    def test_aus_insufficient_funds_fires_blocker(self):
        scoring = self._aus_scoring()
        q = self._aus_question()
        # threshold = 0+29710+2500 = 32210; 5000 < 32210 -> blocker fires
        result = evaluate([q], scoring, {"aus_available_funds": "5000"})
        assert len(result["critical_blockers"]) == 1
        assert result["score"] == 0

    def test_aus_sufficient_funds_no_blocker(self):
        scoring = self._aus_scoring()
        q = self._aus_question()
        result = evaluate([q], scoring, {"aus_available_funds": "50000"})
        assert result["critical_blockers"] == []

    def test_aus_with_tuition_answer_raises_threshold(self):
        scoring = self._aus_scoring()
        q = self._aus_question()
        # threshold = 40000+29710+2500 = 72210
        # answer=72209 < 72210 -> blocker fires
        answers = {
            "aus_available_funds": "72209",
            _AUS_TUITION_QID:      "40000",
        }
        result = evaluate([q], scoring, answers)
        assert len(result["critical_blockers"]) == 1

    def test_aus_exact_threshold_does_not_fire(self):
        scoring = self._aus_scoring()
        q = self._aus_question()
        answers = {
            "aus_available_funds": "72210",
            _AUS_TUITION_QID:      "40000",
        }
        result = evaluate([q], scoring, answers)
        assert result["critical_blockers"] == []

    def test_uk_insufficient_funds_fires(self):
        blocker = {
            "question_id": "uk_available_funds",
            "trigger_if":  {"type": "computed_funds_short"},
            "mapped_rule": "Maintenance",
            "conditional_on": None,
            "message": "Below maintenance.",
        }
        scoring = {
            "score_bands": BANDS,
            "scoring_categories": [],
            "critical_blockers_hard": [blocker],
            "high_risk_flags": [],
            "config": UK_CONFIG,
        }
        q = _make_question("uk_available_funds", pass_if_type="any")
        answers = {
            "uk_available_funds":  "5000",
            _UK_TUITION_QID:       "12000",
            _UK_LOCATION_QID:      "outside_london",
        }
        # threshold = (12000-0) + 10539 = 22539; 5000 < 22539 -> fires
        result = evaluate([q], scoring, answers)
        assert len(result["critical_blockers"]) == 1

    def test_can_quebec_uses_higher_threshold(self):
        blocker = {
            "question_id": "can_living_funds_available",
            "trigger_if":  {"type": "computed_living_short"},
            "mapped_rule": "Living Cost",
            "conditional_on": None,
            "message": "Below living cost.",
        }
        scoring = {
            "score_bands": BANDS,
            "scoring_categories": [],
            "critical_blockers_hard": [blocker],
            "high_risk_flags": [],
            "config": CAN_CONFIG,
        }
        q = _make_question("can_living_funds_available", pass_if_type="any")

        # Non-Quebec: threshold=22895; 23000 passes
        result_nq = evaluate([q], scoring,
                             {"can_living_funds_available": "23000"})
        assert result_nq["critical_blockers"] == []

        # Quebec: threshold=24617; 23000 < 24617 -> fires
        result_qc = evaluate([q], scoring,
                             {"can_living_funds_available": "23000",
                              _CAN_QUEBEC_QID: "yes"})
        assert len(result_qc["critical_blockers"]) == 1
