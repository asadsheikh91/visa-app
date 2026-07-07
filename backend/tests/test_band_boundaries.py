"""
Regression tests for the single source of truth mapping a final score to a band.

The bug these tests pin down: evaluate() used to cap the band LABEL when
high-risk flags fired but left the numeric score uncapped, so a UK check could
persist score=87 with result="High Refusal Risk". The report then rendered the
meter marker at 87 (inside the 85-100 "Low Risk" zone) next to a
"HIGH REFUSAL RISK" badge and a verdict paragraph derived from the same capped
label — three elements, two sources of truth, one contradiction.

Now the cap lowers the score itself and every label is derived from the final
score via readiness_engine.band_for_score. These tests fail loudly if score
and label can ever disagree again.

The band structures below are exact copies of student/{country}/scoring.json
score_bands in R2 (as of 2026-07). If the production bands change, update
these fixtures; scripts/validate_visa_data.py validates the live files.
"""

import pytest

from services.readiness_engine import band_for_score, evaluate

# ---------------------------------------------------------------------------
# Production band structures (labels verbatim from R2 scoring.json)
# ---------------------------------------------------------------------------

def _bands(top_label, moderate_label):
    return [
        {"min": 85, "max": 100, "label": top_label,              "description": "d"},
        {"min": 70, "max": 84,  "label": moderate_label,         "description": "d"},
        {"min": 50, "max": 69,  "label": "High Refusal Risk",    "description": "d"},
        {"min": 0,  "max": 49,  "label": "Critical Refusal Risk","description": "d"},
    ]


COUNTRY_BANDS = {
    "uk": _bands(
        "Low Risk — Appears Well-Prepared for Submission",
        "Moderate Risk — Improve Before Submission",
    ),
    "usa": _bands(
        "Low Risk — Appears Well-Prepared for Interview",
        "Moderate 214(b) Risk — Improve Before Interview",
    ),
    "canada": _bands(
        "Strong Readiness",
        "Moderate Risk — Improve Before Lodging",
    ),
    "australia": _bands(
        "Strong Readiness",
        "Moderate Risk — Improve Before Lodging",
    ),
}

# Band index by rank: 0=critical, 1=high, 2=moderate, 3=top (per COUNTRY_BANDS
# ordering above, which lists top first).
def _label(country, rank):
    ordered = sorted(COUNTRY_BANDS[country], key=lambda b: b["min"])
    return ordered[rank]["label"]


# ---------------------------------------------------------------------------
# 1. band_for_score at every boundary: exact cutoff, cutoff -0.1, cutoff +0.1
# ---------------------------------------------------------------------------

# (score, expected band rank). Fractional scores inside the integer gaps
# (49.x, 69.x, 84.x) must floor into the band below — never fall through to a
# default. evaluate() itself always emits integers, but the mapping function
# is the single source of truth for every caller, so it must be total.
BOUNDARY_CASES = [
    (-1,    0), (0,     0), (0.1,   0),
    (48.9,  0), (49,    0), (49.1,  0), (49.9, 0),
    (50,    1), (50.1,  1),
    (64,    1), (68.9,  1), (69,    1), (69.1, 1), (69.9, 1),
    (70,    2), (70.1,  2),
    (79,    2), (80,    2), (80.1,  2),
    (84,    2), (84.5,  2), (84.9,  2),
    (85,    3), (85.1,  3),
    (95,    3), (100,   3), (100.1, 3), (105,  3),
]


@pytest.mark.parametrize("country", sorted(COUNTRY_BANDS))
@pytest.mark.parametrize("score,expected_rank", BOUNDARY_CASES)
def test_band_for_score_boundaries(country, score, expected_rank):
    bands = COUNTRY_BANDS[country]
    assert band_for_score(score, bands)["label"] == _label(country, expected_rank)


@pytest.mark.parametrize("country", sorted(COUNTRY_BANDS))
def test_band_order_independent(country):
    """The function must not depend on the JSON ordering of score_bands."""
    bands = list(reversed(COUNTRY_BANDS[country]))
    assert band_for_score(87, bands)["label"] == _label(country, 3)
    assert band_for_score(69, bands)["label"] == _label(country, 1)


# ---------------------------------------------------------------------------
# 2. evaluate() invariant: result label == band_for_score(score), always
# ---------------------------------------------------------------------------

def _engine_inputs(country, raw_score, flag_count):
    """
    Build (questions, scoring, answers) so the raw pre-cap score is exactly
    `raw_score` and `flag_count` high-risk flags fire. One scored question that
    always passes carries the whole category weight; flag questions answered
    "no" trigger their flags but carry no score.
    """
    flag_qids = [f"hrf_q{i}" for i in range(flag_count)]
    questions = [{
        "id": "scored_q",
        "question": "Scored?",
        "input_type": "yes_no",
        "score_impact": 10,
        "validation": {"pass_if": {"type": "any"}},
    }] + [{
        "id": qid,
        "question": "Flagged?",
        "input_type": "yes_no",
        "score_impact": 0,
        "validation": {"pass_if": {"type": "eq", "value": "yes"}},
    } for qid in flag_qids]

    scoring = {
        "score_bands": COUNTRY_BANDS[country],
        "scoring_categories": [{
            "category_id": "cat", "label": "Cat",
            "max_points": raw_score, "question_ids": ["scored_q"],
        }],
        "critical_blockers_hard": [],
        "high_risk_flags": [{
            "question_id": qid,
            "trigger_if": {"type": "in", "value": ["no", "unknown"]},
            "message": "High risk.",
        } for qid in flag_qids],
        "config": {},
    }
    answers = {"scored_q": "yes", **{qid: "no" for qid in flag_qids}}
    return questions, scoring, answers


# Raw scores cover every band and both sides of every cutoff. (evaluate()
# rounds to an integer, so fractional raw scores like 80.1 cannot exist at
# this level — the fractional cases are covered by the band_for_score tests.)
RAW_SCORES = [0, 45, 49, 50, 64, 69, 70, 79, 80, 84, 85, 87, 95, 100]
FLAG_COUNTS = [0, 1, 2, 3, 4]


@pytest.mark.parametrize("country", sorted(COUNTRY_BANDS))
@pytest.mark.parametrize("raw_score", RAW_SCORES)
@pytest.mark.parametrize("flag_count", FLAG_COUNTS)
def test_score_and_label_always_agree(country, raw_score, flag_count):
    """THE regression: the persisted label must be the band of the persisted
    score — for every country, every score level, every flag count."""
    questions, scoring, answers = _engine_inputs(country, raw_score, flag_count)
    result = evaluate(questions, scoring, answers)
    bands = COUNTRY_BANDS[country]

    derived = band_for_score(result["score"], bands)["label"]
    assert result["result"] == derived, (
        f"{country}: score {result['score']} sits in band {derived!r} but "
        f"result says {result['result']!r} (raw={raw_score}, flags={flag_count})"
    )


@pytest.mark.parametrize("country", sorted(COUNTRY_BANDS))
@pytest.mark.parametrize("flag_count,cap_max", [(1, 69), (2, 69), (3, 49), (4, 49)])
def test_flags_cap_the_score_not_just_the_label(country, flag_count, cap_max):
    """1-2 flags cap score at the second-lowest band's max; 3+ at the lowest's."""
    questions, scoring, answers = _engine_inputs(country, 95, flag_count)
    result = evaluate(questions, scoring, answers)
    assert result["score"] == cap_max
    assert result["result"] == band_for_score(cap_max, COUNTRY_BANDS[country])["label"]


@pytest.mark.parametrize("country", sorted(COUNTRY_BANDS))
def test_the_original_report_case(country):
    """Raw 87 with one high-risk flag — the exact shape of report
    PV-UK-2026-4358 (score 87 badge 'High Refusal Risk'). Must now come out
    as 69 / High Refusal Risk: consistent marker, badge, and verdict."""
    questions, scoring, answers = _engine_inputs(country, 87, 1)
    result = evaluate(questions, scoring, answers)
    assert result["score"] == 69
    assert result["result"] == "High Refusal Risk"


@pytest.mark.parametrize("country", sorted(COUNTRY_BANDS))
def test_low_score_never_raised_by_cap(country):
    """Capping must never move a score UP into the cap band."""
    questions, scoring, answers = _engine_inputs(country, 45, 2)
    result = evaluate(questions, scoring, answers)
    assert result["score"] == 45
    assert result["result"] == "Critical Refusal Risk"


@pytest.mark.parametrize("country", sorted(COUNTRY_BANDS))
def test_blocker_path_uses_same_source_of_truth(country):
    """Critical blockers force score 0; the label must be band_for_score(0)."""
    questions, scoring, answers = _engine_inputs(country, 87, 0)
    scoring["critical_blockers_hard"] = [{
        "question_id": "scored_q",
        "trigger_if": {"type": "eq", "value": "yes"},
        "message": "Hard stop.",
    }]
    result = evaluate(questions, scoring, answers)
    assert result["score"] == 0
    assert result["result"] == band_for_score(0, COUNTRY_BANDS[country])["label"]
