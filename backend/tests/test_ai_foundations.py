"""
tests/test_ai_foundations.py

Unit tests for Phase 2.0 foundations:
  - ai_client: graceful degradation (no key → AIUnavailableError) + JSON parsing
  - entitlements: per-plan daily limits
"""

import pytest

from services import ai_client
from services.ai_client import AIUnavailableError, AIError, _parse_json
from services import entitlements


# ── ai_client: availability / degradation ────────────────────────────────────

def test_not_available_without_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert ai_client.is_available() is False


def test_complete_json_raises_when_no_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(AIUnavailableError):
        ai_client.complete_json("sys", "user")


def test_complete_text_raises_when_no_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(AIUnavailableError):
        ai_client.complete_text("sys", "user")


def test_default_model_and_override(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_MODEL", raising=False)
    assert ai_client.get_model() == "claude-opus-4-8"
    monkeypatch.setenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    assert ai_client.get_model() == "claude-sonnet-4-6"


# ── ai_client: JSON parsing ───────────────────────────────────────────────────

def test_parse_json_plain():
    assert _parse_json('{"a": 1}') == {"a": 1}


def test_parse_json_strips_code_fence():
    assert _parse_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_parse_json_extracts_object_from_prose():
    assert _parse_json('Here you go: {"a": 1} thanks') == {"a": 1}


def test_parse_json_raises_on_junk():
    with pytest.raises(AIError):
        _parse_json("not json at all")


def test_parse_json_raises_on_non_object():
    with pytest.raises(AIError):
        _parse_json("[1, 2, 3]")


# ── entitlements: limits ──────────────────────────────────────────────────────

class _FakeUser:
    def __init__(self, plan="free"):
        self.plan = plan


def test_free_limits_defined():
    assert entitlements.FREE_LIMITS["sop_review"] >= 1
    assert entitlements.FREE_LIMITS["interview"] >= 1


def test_limit_for_free_user():
    u = _FakeUser("free")
    assert entitlements.limit_for(u, "sop_review") == entitlements.FREE_LIMITS["sop_review"]
    assert entitlements.limit_for(u, "unknown_feature") == 0


def test_limit_for_paid_user_is_unlimited():
    u = _FakeUser("pro")
    assert entitlements.limit_for(u, "sop_review") > entitlements.FREE_LIMITS["sop_review"]
