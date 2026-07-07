"""
tests/test_interview_engine.py

Unit tests for the mock-interview engine (Module F). The AI client is mocked.
"""

import pytest

from services import ai_client
from services import interview_engine
from services.interview_engine import (
    next_question, assess, _to_messages, _normalize_assessment,
)


def test_to_messages_starts_with_user_and_alternates():
    transcript = [
        {"role": "interviewer", "content": "Why this course?"},
        {"role": "student", "content": "Because I love AI."},
        {"role": "interviewer", "content": "Why this country?"},
        {"role": "student", "content": "Great universities."},
    ]
    msgs = _to_messages(transcript)
    assert msgs[0]["role"] == "user"                 # kickoff
    # strict alternation user/assistant/user/...
    roles = [m["role"] for m in msgs]
    assert all(roles[i] != roles[i + 1] for i in range(len(roles) - 1))


def test_next_question_returns_text(monkeypatch):
    monkeypatch.setattr(ai_client, "complete_messages", lambda *a, **k: "What will you study?")
    assert next_question("uk", []) == "What will you study?"


def test_next_question_fallback_on_empty(monkeypatch):
    monkeypatch.setattr(ai_client, "complete_messages", lambda *a, **k: "   ")
    q = next_question("uk", [])
    assert q  # non-empty fallback


def test_next_question_propagates_unavailable(monkeypatch):
    def _raise(*a, **k):
        raise ai_client.AIUnavailableError("no key")
    monkeypatch.setattr(ai_client, "complete_messages", _raise)
    with pytest.raises(ai_client.AIUnavailableError):
        next_question("uk", [])


def test_assess_requires_answers():
    with pytest.raises(ValueError):
        assess("uk", [{"role": "interviewer", "content": "Q?"}])


def test_assess_happy_path(monkeypatch):
    transcript = [
        {"role": "interviewer", "content": "Why this course?"},
        {"role": "student", "content": "I want to be an ML engineer."},
    ]
    monkeypatch.setattr(ai_client, "complete_json", lambda *a, **k: {
        "overall_score": 72,
        "verdict": "Credible overall.",
        "strengths": ["Clear course rationale"],
        "weaknesses": ["Vague on finances"],
        "tips": ["Quantify your funding"],
    })
    result = assess("uk", transcript)
    assert result["overall_score"] == 72
    assert result["strengths"] == ["Clear course rationale"]


def test_normalize_assessment_coerces():
    out = _normalize_assessment({
        "overall_score": "90",
        "verdict": "  ok  ",
        "strengths": "single",
        "weaknesses": None,
        "tips": ["a", "b"],
    })
    assert out["overall_score"] == 90
    assert out["verdict"] == "ok"
    assert out["strengths"] == ["single"]
    assert out["weaknesses"] == []
    assert out["tips"] == ["a", "b"]
