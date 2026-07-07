"""
readiness_engine.py -- Phase 1A + 1B + 1C + 4A

Phase 1A: structured condition evaluator + corrected _is_passing().
Phase 1B: critical_blockers_hard key, trigger_if dispatch, computed funds
          evaluation, high_risk_flags evaluation, band capping.
Phase 1C: explicit config-driven financial thresholds replacing heuristic
          scanning; UK tuition component added; CAN Quebec branching;
          AUS dependant addition with honest limitation logging.
Phase 4A: soft_warnings evaluation from scoring.json; normalize_answers per
          question input_type; sources_used collected from triggered issues.
"""

import logging
import re
from datetime import datetime as _datetime
from typing import Any

logger = logging.getLogger(__name__)

Question = dict[str, Any]
Scoring  = dict[str, Any]
Answers  = dict[str, Any]


# ---------------------------------------------------------------------------
# Explicit financial question ID constants
# ---------------------------------------------------------------------------

# Australia
_AUS_TUITION_QID       = "aus_tuition_first_year"
_AUS_DEPENDANT_QID     = "aus_has_dependant_funds"

# United Kingdom
_UK_TUITION_QID        = "uk_first_year_tuition_fee"
_UK_TUITION_PAID_QID   = "uk_tuition_fee_paid"
_UK_LOCATION_QID       = "uk_course_location"

# Canada
_CAN_TUITION_QID       = "can_tuition_amount"
_CAN_QUEBEC_QID        = "can_is_quebec_applicant"
_CAN_PROVINCE_QID      = "can_study_province"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_numeric(value):
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace(",", "").replace(" ", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _to_list(answer):
    if isinstance(answer, list):
        return [str(v).strip().lower() for v in answer if str(v).strip()]
    if isinstance(answer, str):
        if "," in answer:
            return [v.strip().lower() for v in answer.split(",") if v.strip()]
        stripped = answer.strip()
        if stripped:
            return [stripped.lower()]
    return []


# ---------------------------------------------------------------------------
# Condition evaluator (Phase 1A)
# ---------------------------------------------------------------------------

def evaluate_condition(condition, answer, all_answers=None):
    """
    Evaluates a structured {type, value} condition against a user answer.
    Supported: any, never, eq, neq, in, not_in, gte, gt, lte, lt, multi_has_any.
    computed_* types return False here -- handled by _evaluate_computed_trigger.
    Unknown/malformed types return False, never raise.
    """
    if not condition or not isinstance(condition, dict):
        return False

    ctype = condition.get("type", "")

    if ctype == "any":
        if isinstance(answer, list):
            return bool(answer)
        return answer is not None and answer != ""

    if ctype == "never":
        return False

    if answer is None or answer == "" or answer == []:
        return False

    cval = condition.get("value")

    if ctype in ("eq", "neq"):
        if cval is None:
            return False
        a = str(answer).strip().lower()
        c = str(cval).strip().lower()
        return (a == c) if ctype == "eq" else (a != c)

    if ctype in ("in", "not_in"):
        if not isinstance(cval, list):
            return False
        a = str(answer).strip().lower()
        s = {str(v).strip().lower() for v in cval}
        return (a in s) if ctype == "in" else (a not in s)

    if ctype in ("gte", "gt", "lte", "lt"):
        num = _to_numeric(answer)
        thr = _to_numeric(cval)
        if num is None or thr is None:
            return False
        if ctype == "gte": return num >= thr
        if ctype == "gt":  return num >  thr
        if ctype == "lte": return num <= thr
        if ctype == "lt":  return num <  thr

    if ctype == "multi_has_any":
        if not isinstance(cval, list):
            return False
        items = _to_list(answer)
        t     = {str(v).strip().lower() for v in cval}
        return any(i in t for i in items)

    if ctype.startswith("computed_"):
        logger.debug("Condition %r needs external context - skip (Phase 1B).", ctype)
        return False

    logger.warning("Unsupported condition type %r - returning False.", ctype)
    return False


# ---------------------------------------------------------------------------
# Pass-if resolver (Phase 1A)
# ---------------------------------------------------------------------------

def _get_pass_if(question):
    """Priority: validation.pass_if > flat pass_if > None."""
    v = question.get("validation")
    if isinstance(v, dict):
        p = v.get("pass_if")
        if isinstance(p, dict):
            return p
    f = question.get("pass_if")
    if isinstance(f, dict):
        return f
    return None


def _question_id(q):
    return q.get("id") or q.get("question_id") or ""


def _question_help(q):
    return q.get("help_text") or q.get("user_help_text") or ""


def _question_text(q):
    return q.get("question") or q.get("question_text") or ""


def _is_passing(answer, question):
    """
    Returns True if answer satisfies pass_if.
    Supports validation.pass_if (canonical) and flat pass_if (UK compat).
    Returns False if no pass condition defined.
    """
    p = _get_pass_if(question)
    if p is None:
        return False
    return evaluate_condition(p, answer)


# ---------------------------------------------------------------------------
# Computed financial threshold helpers (Phase 1C)
# ---------------------------------------------------------------------------

def _threshold_aus(ctype, config, answers):
    if ctype not in ("computed_funds_short", "computed_funds_ok"):
        logger.warning("AUS threshold: unexpected computed type %r.", ctype)
        return None

    tuition_raw = answers.get(_AUS_TUITION_QID)
    tuition     = _to_numeric(tuition_raw) if tuition_raw is not None else None
    if tuition is None:
        logger.warning(
            "AUS computed_funds threshold: answer for %r not found or non-numeric "
            "(value=%r); using 0 -- threshold may be understated.",
            _AUS_TUITION_QID, tuition_raw
        )
        tuition = 0.0

    living  = float(config.get("living_cost_single_12m", 0) or 0)
    airfare = float(config.get("return_airfare_estimate",  0) or 0)

    dependant_ans = str(answers.get(_AUS_DEPENDANT_QID, "")).lower()
    partner_add   = _to_numeric(config.get("living_cost_partner_add")) or 0.0

    if dependant_ans in ("", "not_applicable"):
        dependant_addition = 0.0
    elif dependant_ans in ("yes", "no"):
        logger.warning(
            "AUS computed_funds: dependant indicated (%r=%r) but count is unknown. "
            "Adding minimum one-partner cost (%g AUD). "
            "Threshold is understated for multiple dependants.",
            _AUS_DEPENDANT_QID, dependant_ans, partner_add
        )
        dependant_addition = partner_add
    else:
        dependant_addition = 0.0

    return tuition + living + airfare + dependant_addition


def _threshold_uk(ctype, config, answers):
    if ctype not in ("computed_funds_short", "computed_funds_ok"):
        logger.warning("UK threshold: unexpected computed type %r.", ctype)
        return None

    tuition_raw = answers.get(_UK_TUITION_QID)
    tuition     = _to_numeric(tuition_raw) if tuition_raw is not None else None
    if tuition is None:
        logger.warning(
            "UK computed_funds threshold: answer for %r not found or non-numeric "
            "(value=%r); using 0 -- threshold may be understated.",
            _UK_TUITION_QID, tuition_raw
        )
        tuition = 0.0

    paid_raw = answers.get(_UK_TUITION_PAID_QID)
    paid     = _to_numeric(paid_raw) if paid_raw is not None else 0.0
    if paid is None:
        paid = 0.0

    net_tuition = max(0.0, tuition - paid)

    location = str(answers.get(_UK_LOCATION_QID, "")).lower()
    if location == "london":
        maintenance = _to_numeric(config.get("maintenance_london_total"))
    else:
        maintenance = _to_numeric(config.get("maintenance_outside_total"))

    if maintenance is None:
        logger.warning(
            "UK computed_funds threshold: maintenance config key "
            "('maintenance_london_total' or 'maintenance_outside_total') missing."
        )
        return None

    return net_tuition + maintenance


def _threshold_can(ctype, config, answers):
    if ctype not in ("computed_living_short", "computed_living_ok",
                     "computed_total_short",  "computed_total_ok"):
        logger.warning("CAN threshold: unexpected computed type %r.", ctype)
        return None

    is_quebec = (
        str(answers.get(_CAN_QUEBEC_QID,   "")).lower() == "yes"
        or str(answers.get(_CAN_PROVINCE_QID, "")).lower() == "quebec"
    )

    if is_quebec:
        living = _to_numeric(config.get("quebec_single_adult"))
        if living is None:
            logger.warning(
                "CAN computed threshold: applicant is in Quebec but "
                "'quebec_single_adult' config key is missing. "
                "Cannot apply Quebec-specific threshold -- returning None."
            )
            return None
    else:
        living = _to_numeric(config.get("living_cost_single_outside_quebec"))
        if living is None:
            logger.warning(
                "CAN computed threshold: 'living_cost_single_outside_quebec' "
                "config key missing."
            )
            return None

    if ctype in ("computed_living_short", "computed_living_ok"):
        return living

    transport   = _to_numeric(config.get("return_transport_estimate")) or 0.0
    tuition_raw = answers.get(_CAN_TUITION_QID)
    tuition     = _to_numeric(tuition_raw) if tuition_raw is not None else None
    if tuition is None:
        logger.warning(
            "CAN computed_total threshold: answer for %r not found or non-numeric "
            "(value=%r); using 0 -- threshold may be understated.",
            _CAN_TUITION_QID, tuition_raw
        )
        tuition = 0.0

    return tuition + living + transport


def _compute_financial_threshold(ctype, config, all_answers):
    a = all_answers or {}

    if "living_cost_single_12m" in config:
        return _threshold_aus(ctype, config, a)

    if "maintenance_london_total" in config:
        return _threshold_uk(ctype, config, a)

    if "living_cost_single_outside_quebec" in config:
        return _threshold_can(ctype, config, a)

    logger.warning(
        "_compute_financial_threshold: no recognised country-indicator key in config "
        "(checked: living_cost_single_12m, maintenance_london_total, "
        "living_cost_single_outside_quebec). Cannot compute %r.", ctype
    )
    return None


# ---------------------------------------------------------------------------
# Computed financial trigger (Phase 1B)
# ---------------------------------------------------------------------------

def _evaluate_computed_trigger(ctype, answer, all_answers, config):
    threshold = _compute_financial_threshold(ctype, config, all_answers)
    if threshold is None:
        logger.warning(
            "computed trigger %r: could not compute threshold "
            "(missing config or answer) -- blocker not fired.", ctype
        )
        return False

    num = _to_numeric(answer)
    if num is None:
        logger.warning(
            "computed trigger %r: answer %r is not numeric -- blocker not fired.",
            ctype, answer
        )
        return False

    if "_short" in ctype:
        return num < threshold

    if "_ok" in ctype:
        return False

    return False


# ---------------------------------------------------------------------------
# Band helpers (Phase 1B)
# ---------------------------------------------------------------------------

def band_for_score(score, bands):
    """
    THE single source of truth mapping a final numeric score to its band.

    Every band label shown anywhere (engine result, report badge, verdict
    paragraph, meter highlight) must come from this function applied to the
    final score. Do not duplicate threshold logic elsewhere.

    Semantics: bands sorted by "min" ascending; returns the highest band whose
    "min" <= score. This is equivalent to min <= score <= max for in-range
    values, and additionally well-defined for values the integer band edges do
    not cover: fractional scores inside a gap (e.g. 84.5 with bands 70-84 /
    85-100) fall into the band below, scores above the top band's max return
    the top band, and scores below the lowest "min" return the lowest band.
    """
    ordered = sorted(bands, key=lambda b: b.get("min", 0))
    chosen = ordered[0]
    for band in ordered:
        if score >= band["min"]:
            chosen = band
        else:
            break
    return chosen


def _get_band(score, bands):
    # Backward-compatible alias; the logic lives in band_for_score.
    return band_for_score(score, bands)


def _lowest_band(bands):
    return min(bands, key=lambda b: b["min"])


def _second_lowest_band(bands):
    sorted_b = sorted(bands, key=lambda b: b["min"])
    return sorted_b[1] if len(sorted_b) > 1 else sorted_b[0]


def _apply_band_cap(band, flag_count, bands):
    if flag_count == 0:
        return band
    cap = _lowest_band(bands) if flag_count >= 3 else _second_lowest_band(bands)
    if band["min"] > cap["min"]:
        return cap
    return band


# ---------------------------------------------------------------------------
# Conditional_on helper
# ---------------------------------------------------------------------------

def _conditional_satisfied(blocker_or_flag, answers):
    cond_on = blocker_or_flag.get("conditional_on")
    if not cond_on or not isinstance(cond_on, dict):
        return True
    qid      = cond_on.get("question_id")
    operator = cond_on.get("operator", "eq")
    value    = cond_on.get("value")
    answer   = answers.get(qid) if qid else None
    return evaluate_condition({"type": operator, "value": value}, answer)


# ---------------------------------------------------------------------------
# Result enrichment
# ---------------------------------------------------------------------------

def _enrich_issue(qid, blocker_or_flag, question):
    """
    Builds an enriched issue dict from a blocker, high-risk flag, or soft warning.

    Phase 4A extension: also checks the issue dict itself for mapped_rule_id
    (present on soft_warnings in UK/USA/CAN data) before falling back to the
    question. Backward-compatible — blockers and flags have no mapped_rule_id
    in their dicts so existing behaviour is unchanged.
    """
    d = {
        "question_id": qid,
        "message": (
            blocker_or_flag.get("message")
            or (question and _question_help(question))
            or ""
        ),
        "rule": (
            blocker_or_flag.get("mapped_rule")
            or blocker_or_flag.get("mapped_rule_name")
            or (question and question.get("mapped_rule", ""))
            or ""
        ),
    }
    # rule_id: prefer from the issue definition first, then from question
    rule_id = (
        blocker_or_flag.get("mapped_rule_id")
        or (question and question.get("mapped_rule_id"))
    )
    if rule_id:
        d["rule_id"] = rule_id

    if question:
        if question.get("risk_category"):
            d["severity"] = question["risk_category"]
        if question.get("source_url"):
            d["source_url"] = question["source_url"]
        if question.get("source_ids"):
            d["source_ids"] = question["source_ids"]
    return d


# ---------------------------------------------------------------------------
# Soft warnings evaluator (Phase 4A)
# ---------------------------------------------------------------------------

def _evaluate_soft_warnings(soft_warning_defs, answers, question_map, config):
    """
    Evaluates soft_warning definitions from scoring["soft_warnings"].

    Same evaluation pattern as high_risk_flags:
      1. Check conditional_on if present.
      2. Skip if answer is absent.
      3. Evaluate trigger_if (including computed_ types).

    Malformed entries are skipped with a warning log — never raise.
    Returns a list of triggered soft warning dicts.
    """
    triggered = []
    for sw in soft_warning_defs:
        if not isinstance(sw, dict):
            logger.warning("Malformed soft_warning entry (not a dict): %r", sw)
            continue

        qid = sw.get("question_id")
        if not qid:
            logger.warning("soft_warning missing question_id: %r", sw)
            continue

        question = question_map.get(qid)

        if not _conditional_satisfied(sw, answers):
            continue

        answer     = answers.get(qid)
        trigger_if = sw.get("trigger_if") or {}
        ctype      = trigger_if.get("type", "")

        if answer is None or answer == "":
            continue

        try:
            if ctype.startswith("computed_"):
                fired = _evaluate_computed_trigger(ctype, answer, answers, config)
            else:
                fired = evaluate_condition(trigger_if, answer, answers)
        except Exception:
            logger.warning(
                "Exception evaluating soft_warning %r trigger_if=%r -- skipping.",
                qid, trigger_if, exc_info=True
            )
            continue

        if fired:
            triggered.append(_enrich_issue(qid, sw, question))

    return triggered


# ---------------------------------------------------------------------------
# Answer normalizer (Phase 4A)
# ---------------------------------------------------------------------------

_DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%m-%d-%Y",
                 "%Y/%m/%d", "%d %b %Y", "%d %B %Y")
_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def normalize_answer(answer, input_type: str):
    """
    Normalizes a single answer value based on the question's input_type.

    Rules:
      yes_no            -> lowercase "yes" or "no"
      yes_no_unknown    -> lowercase "yes", "no", or "unknown"
      single_choice     -> str, stripped
      multi_choice      -> list[str], each stripped
      currency_amount   -> float (commas stripped); original string if non-numeric
      number            -> float; original if non-numeric
      date              -> YYYY-MM-DD string; original if unparseable
      text              -> str, stripped
      (anything else)   -> returned unchanged

    Does NOT mutate the original answer.
    """
    if answer is None:
        return None

    if input_type in ("yes_no", "yes_no_unknown"):
        return str(answer).strip().lower()

    if input_type == "single_choice":
        return str(answer).strip()

    if input_type == "multi_choice":
        if isinstance(answer, list):
            return [str(v).strip() for v in answer if str(v).strip()]
        if isinstance(answer, str):
            if "," in answer:
                return [v.strip() for v in answer.split(",") if v.strip()]
            stripped = answer.strip()
            return [stripped] if stripped else []
        return []

    if input_type in ("currency_amount", "number"):
        num = _to_numeric(answer)
        return num if num is not None else answer

    if input_type == "date":
        s = str(answer).strip()
        if _DATE_PATTERN.match(s):
            return s
        for fmt in _DATE_FORMATS:
            try:
                return _datetime.strptime(s, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return s  # return as-is if no format matched

    if input_type == "text":
        return str(answer).strip()

    # Unknown input type — return unchanged
    return answer


def normalize_answers(questions, answers: dict) -> dict:
    """
    Returns a new dict mapping question_id -> normalized_answer for every
    answered question.  The original answers dict is NOT mutated.

    Questions with no answer are omitted from the output.
    Unknown question IDs in answers are treated as input_type="text".
    """
    type_map: dict[str, str] = {}
    for q in questions:
        qid = _question_id(q)
        if qid:
            type_map[qid] = q.get("input_type", "text")

    result: dict = {}
    for qid, answer in answers.items():
        if answer is None:
            continue
        input_type = type_map.get(qid, "text")
        result[qid] = normalize_answer(answer, input_type)
    return result


# ---------------------------------------------------------------------------
# Sources used collector (Phase 4A)
# ---------------------------------------------------------------------------

def _collect_sources_used(issues: list, question_map: dict) -> list:
    """
    Collects de-duplicated source references from a list of triggered issues
    (critical_blockers, high_risk_flags, soft_warnings).

    Each issue may carry source_url and/or source_ids (populated by
    _enrich_issue from the question metadata).

    Returns a list of source reference dicts, each with at least one of:
      { "source_url": "...", "source_ids": [...] }

    De-duplication key: source_url if present; first source_id otherwise.

    NOTE: Full source resolution (name, title, description) belongs to the
    service/API layer which has access to sources.json.  The engine only has
    question-level URL/ID metadata.  Pass resolved_sources into the engine
    (Phase 5) if enriched source objects are needed in the response.
    """
    seen:    set  = set()
    sources: list = []

    for issue in issues:
        url  = issue.get("source_url")
        sids = issue.get("source_ids") or []

        if url:
            if url not in seen:
                seen.add(url)
                entry: dict = {"source_url": url}
                if sids:
                    entry["source_ids"] = sids
                sources.append(entry)
        elif sids:
            # No direct URL — deduplicate by first source_id
            key = sids[0]
            if key not in seen:
                seen.add(key)
                sources.append({"source_ids": sids})

    return sources


# ---------------------------------------------------------------------------
# Main evaluate
# ---------------------------------------------------------------------------

def evaluate(questions, scoring, answers):
    """
    Evaluates answers against scoring data and returns:
      score, result, result_description,
      critical_blockers, high_risk_flags, soft_warnings,
      warnings (backward-compat auto-computed per-question warnings),
      recommendations, normalized_answers, sources_used
    """
    score_bands        = scoring["score_bands"]
    scoring_categories = scoring["scoring_categories"]
    config             = scoring.get("config", {})
    scoring_blockers   = scoring.get("critical_blockers_hard", [])
    high_risk_defs     = scoring.get("high_risk_flags", [])
    soft_warning_defs  = scoring.get("soft_warnings", [])

    question_map: dict = {}
    for q in questions:
        k = _question_id(q)
        if k:
            question_map[k] = q

    # Step 1: critical blockers
    critical_blockers = []
    for blocker in scoring_blockers:
        qid      = blocker["question_id"]
        question = question_map.get(qid)

        if not _conditional_satisfied(blocker, answers):
            continue

        answer     = answers.get(qid)
        trigger_if = blocker.get("trigger_if") or {}
        ctype      = trigger_if.get("type", "")

        if question and question.get("required") and (answer is None or answer == ""):
            critical_blockers.append(_enrich_issue(qid, blocker, question))
            continue

        if answer is None:
            continue

        if ctype.startswith("computed_"):
            triggered = _evaluate_computed_trigger(ctype, answer, answers, config)
        else:
            triggered = evaluate_condition(trigger_if, answer, answers)

        if triggered:
            critical_blockers.append(_enrich_issue(qid, blocker, question))

    if critical_blockers:
        # Score is forced to 0, so the label comes from band_for_score(0) —
        # same single source of truth as the main path.
        not_ready = band_for_score(0, score_bands)
        normalized = normalize_answers(questions, answers)
        sources    = _collect_sources_used(critical_blockers, question_map)
        return {
            "score":              0,
            "result":             not_ready["label"],
            "result_description": not_ready["description"],
            "critical_blockers":  critical_blockers,
            "high_risk_flags":    [],
            "soft_warnings":      [],
            "warnings":           [],
            "recommendations":    _build_recommendations(not_ready["label"], critical_blockers, [], []),
            "normalized_answers": normalized,
            "sources_used":       sources,
        }

    # Step 2: score
    total_score  = 0.0
    blocker_qids = {b["question_id"] for b in scoring_blockers}

    for category in scoring_categories:
        cat_qs = [question_map[qid] for qid in category["question_ids"] if qid in question_map]
        total_impact = sum(q.get("score_impact", 0) for q in cat_qs)
        if total_impact == 0:
            continue
        passing_impact = sum(
            q.get("score_impact", 0)
            for q in cat_qs
            if _is_passing(answers.get(_question_id(q)), q)
        )
        total_score += round((passing_impact / total_impact) * category["max_points"], 1)

    final_score = round(total_score)

    # Step 3: high-risk flags
    triggered_flags = []
    for flag in high_risk_defs:
        qid = flag["question_id"]
        question = question_map.get(qid)

        if not _conditional_satisfied(flag, answers):
            continue

        answer     = answers.get(qid)
        trigger_if = flag.get("trigger_if") or {}
        ctype      = trigger_if.get("type", "")

        if answer is None or answer == "":
            continue

        if ctype.startswith("computed_"):
            triggered = _evaluate_computed_trigger(ctype, answer, answers, config)
        else:
            triggered = evaluate_condition(trigger_if, answer, answers)

        if triggered:
            triggered_flags.append(_enrich_issue(qid, flag, question))

    # Step 4: band + cap.
    # The cap lowers the SCORE (to the cap band's max), and the band is then
    # derived from the final score via band_for_score — so the numeric score
    # and its label can never disagree. Capping only the label while leaving
    # the score uncapped is exactly the bug that produced reports showing
    # "87/100" next to a "High Refusal Risk" badge.
    capped = _apply_band_cap(band_for_score(final_score, score_bands),
                             len(triggered_flags), score_bands)
    if final_score > capped["max"]:
        final_score = capped["max"]
    band = band_for_score(final_score, score_bands)

    # Step 5: soft warnings (Phase 4A)
    soft_warnings = _evaluate_soft_warnings(
        soft_warning_defs, answers, question_map, config
    )

    # Step 6: auto-computed per-question warnings (backward-compat)
    # These are questions that don't pass their pass_if, excluding blocker/flag questions.
    # Kept separate from soft_warnings for API backward compatibility.
    flag_qids = {f["question_id"] for f in high_risk_defs}
    warnings  = []
    for question in questions:
        qid = _question_id(question)
        if qid in blocker_qids or qid in flag_qids:
            continue
        answer = answers.get(qid)
        if answer is None or answer == "":
            continue
        if not _is_passing(answer, question) and _question_help(question):
            warnings.append({"question_id": qid, "message": _question_help(question)})

    # Step 7: normalized answers (Phase 4A)
    normalized = normalize_answers(questions, answers)

    # Step 8: sources used (Phase 4A) — collected from all triggered issues
    all_triggered = triggered_flags + soft_warnings
    sources = _collect_sources_used(all_triggered, question_map)

    return {
        "score":              final_score,
        "result":             band["label"],
        "result_description": band["description"],
        "critical_blockers":  [],
        "high_risk_flags":    triggered_flags,
        "soft_warnings":      soft_warnings,
        "warnings":           warnings,
        "recommendations":    _build_recommendations(band["label"], [], triggered_flags, warnings),
        "normalized_answers": normalized,
        "sources_used":       sources,
    }


# ---------------------------------------------------------------------------
# Per-category breakdown (read-only view for the Readiness Report)
# ---------------------------------------------------------------------------

def category_breakdown(questions, scoring, answers):
    """
    Per-criterion 0–100 scores, using the SAME pass logic as evaluate() (this
    reuses _is_passing / _question_id rather than re-deriving the formula, so the
    breakdown can never drift from the headline score).

    Returns a list of dicts, one per scoring category, in scoring order:
        {category_id, label, sublabel, score}  where score is 0–100.

    A category whose questions carry no score_impact scores 0. This is a pure,
    read-only view — it does not affect evaluate()'s output in any way.
    """
    question_map: dict = {}
    for q in questions:
        k = _question_id(q)
        if k:
            question_map[k] = q

    out: list[dict] = []
    for category in scoring.get("scoring_categories", []):
        cat_qs = [
            question_map[qid]
            for qid in category.get("question_ids", [])
            if qid in question_map
        ]
        total_impact = sum(q.get("score_impact", 0) for q in cat_qs)
        if total_impact == 0:
            pct = 0
        else:
            passing_impact = sum(
                q.get("score_impact", 0)
                for q in cat_qs
                if _is_passing(answers.get(_question_id(q)), q)
            )
            pct = round(passing_impact / total_impact * 100)
        out.append({
            "category_id": category.get("category_id", ""),
            "label":       category.get("label") or category.get("category_id", ""),
            "sublabel":    category.get("sublabel") or category.get("description", "") or "",
            "score":       pct,
        })
    return out


# ---------------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------------

def _build_recommendations(result, blockers, flags, warnings):
    recs = []
    if blockers:
        n = len(blockers)
        recs.append("You have {} critical issue{} that must be resolved before applying.".format(
            n, "s" if n > 1 else ""))
    if flags:
        n = len(flags)
        recs.append(
            "{} high-risk flag{} detected. Resolve {} before lodging to avoid refusal.".format(
                n, "s" if n > 1 else "", "them" if n > 1 else "it"))
    if warnings:
        n = len(warnings)
        recs.append("Address the {} flagged item{} to strengthen your application.".format(
            n, "s" if n > 1 else ""))
    label = result.lower()
    if "not" not in label and "almost" not in label and "work" not in label and "ready" in label:
        recs.append("Your application looks strong. Review all documents one final time before lodging.")
    elif "almost" in label:
        recs.append("You are close. Resolve the flagged items before submitting.")
    elif "work" in label or "improve" in label:
        recs.append("Do not lodge yet. Work through every flagged item first.")
    return recs
