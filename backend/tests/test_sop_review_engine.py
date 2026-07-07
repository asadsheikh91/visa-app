"""
tests/test_sop_review_engine.py

Unit tests for the SOP reviewer engine (Module E). The AI client is mocked, so
no network/key is needed.
"""

import pytest

from services import ai_client
from services import sop_review_engine
from services.sop_review_engine import build_review, MIN_CHARS, _normalize


LONG_SOP = "I want to study computer science. " * 20  # > MIN_CHARS


def _good_response():
    return {
        "overall_score": 78,
        "verdict": "Strong but tighten the career link.",
        "sections": [
            {"name": "Genuine intent", "score": 80, "assessment": "Clear.",
             "suggestions": ["Add specifics"]},
            {"name": "Ties to home country", "score": 60, "assessment": "Weak.",
             "suggestions": ["Mention family business"]},
        ],
        "red_flags": ["Vague return plans"],
        "rewrite_tips": ["Open with a concrete anecdote"],
    }


def test_too_short_raises():
    with pytest.raises(ValueError):
        build_review("too short", "uk")


def test_too_long_raises():
    with pytest.raises(ValueError):
        build_review("x" * 20_000, "uk")


def test_build_review_happy_path(monkeypatch):
    monkeypatch.setattr(ai_client, "complete_json", lambda *a, **k: _good_response())
    result = build_review(LONG_SOP, "uk")
    assert result["overall_score"] == 78
    assert len(result["sections"]) == 2
    assert result["red_flags"] == ["Vague return plans"]


def test_build_review_coerces_messy_types(monkeypatch):
    messy = {
        "overall_score": "85",                       # string number
        "verdict": "  Good  ",
        "sections": [
            {"name": "Clarity", "score": "not-a-number", "assessment": "ok",
             "suggestions": "single tip"},           # string not list
            {"assessment": "no name — dropped"},      # no name → dropped
        ],
        "red_flags": "one flag",                      # string not list
        "rewrite_tips": None,
    }
    monkeypatch.setattr(ai_client, "complete_json", lambda *a, **k: messy)
    result = build_review(LONG_SOP, "uk")
    assert result["overall_score"] == 85
    assert result["verdict"] == "Good"
    assert len(result["sections"]) == 1                # nameless one dropped
    assert result["sections"][0]["score"] == 0         # bad score → 0
    assert result["sections"][0]["suggestions"] == ["single tip"]
    assert result["red_flags"] == ["one flag"]
    assert result["rewrite_tips"] == []


def test_build_review_empty_response_raises(monkeypatch):
    monkeypatch.setattr(ai_client, "complete_json", lambda *a, **k: {})
    with pytest.raises(ai_client.AIError):
        build_review(LONG_SOP, "uk")


def test_build_review_propagates_unavailable(monkeypatch):
    def _raise(*a, **k):
        raise ai_client.AIUnavailableError("no key")
    monkeypatch.setattr(ai_client, "complete_json", _raise)
    with pytest.raises(ai_client.AIUnavailableError):
        build_review(LONG_SOP, "uk")


def test_normalize_clamps_scores():
    out = _normalize({"overall_score": 250, "sections": [], "red_flags": [], "rewrite_tips": []})
    assert out["overall_score"] == 100
