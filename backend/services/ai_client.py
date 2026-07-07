"""
ai_client.py

Phase 2.0: thin wrapper around Anthropic's Claude API for the AI features
(SOP reviewer, mock interview).

Design goals:
  - Graceful degradation: when ANTHROPIC_API_KEY is unset, every call raises
    AIUnavailableError, which routers map to HTTP 503 — exactly like the
    currency service degrades when its provider key is missing. This lets the
    whole app ship before a key is available.
  - No import-time dependency on a key. The Anthropic SDK is imported lazily so
    `import main` always works.

Model is configurable via ANTHROPIC_MODEL (default: latest Claude Opus). For a
cheaper option set ANTHROPIC_MODEL=claude-sonnet-4-6.
"""

import json
import logging
import os
import re

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-opus-4-8"


class AIUnavailableError(Exception):
    """AI is not configured (no API key) or the SDK is missing → surface as 503."""


class AIError(Exception):
    """The provider was reached but the call/parse failed → surface as 502."""


def get_api_key() -> str:
    return os.getenv("ANTHROPIC_API_KEY", "").strip()


def get_model() -> str:
    return os.getenv("ANTHROPIC_MODEL", "").strip() or DEFAULT_MODEL


def is_available() -> bool:
    """True when an API key is configured. Cheap check for routers/health."""
    return bool(get_api_key())


def _client():
    key = get_api_key()
    if not key:
        raise AIUnavailableError(
            "AI features are not configured yet (missing ANTHROPIC_API_KEY)."
        )
    try:
        import anthropic
    except ImportError as exc:  # pragma: no cover - SDK is in requirements
        raise AIUnavailableError("The Anthropic SDK is not installed.") from exc
    return anthropic.Anthropic(api_key=key)


def _text_from_message(msg) -> str:
    return "".join(
        block.text for block in msg.content if getattr(block, "type", None) == "text"
    )


def complete_text(
    system: str,
    user: str,
    *,
    max_tokens: int = 1024,
    temperature: float = 0.4,
) -> str:
    """Single-turn completion returning the raw text. Raises AIUnavailableError/AIError."""
    client = _client()
    try:
        msg = client.messages.create(
            model=get_model(),
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return _text_from_message(msg).strip()
    except AIUnavailableError:
        raise
    except Exception as exc:
        logger.warning("AI completion failed: %s", exc)
        raise AIError("The AI provider is temporarily unavailable.") from exc


def complete_messages(
    system: str,
    messages: list[dict],
    *,
    max_tokens: int = 1024,
    temperature: float = 0.4,
) -> str:
    """Multi-turn completion (for the interview). `messages` is the Anthropic format."""
    client = _client()
    try:
        msg = client.messages.create(
            model=get_model(),
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=messages,
        )
        return _text_from_message(msg).strip()
    except AIUnavailableError:
        raise
    except Exception as exc:
        logger.warning("AI completion failed: %s", exc)
        raise AIError("The AI provider is temporarily unavailable.") from exc


_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    cleaned = _FENCE_RE.sub("", cleaned).strip()
    # If extra prose slipped in, grab the outermost JSON object.
    if not cleaned.startswith("{"):
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start:end + 1]
    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise AIError("The AI returned an unparseable response.") from exc
    if not isinstance(result, dict):
        raise AIError("The AI response was not a JSON object.")
    return result


def complete_json(
    system: str,
    user: str,
    *,
    max_tokens: int = 2048,
    temperature: float = 0.2,
) -> dict:
    """
    Single-turn completion that returns a parsed JSON object.

    The system prompt is augmented to force JSON-only output. Raises
    AIUnavailableError (no key) or AIError (provider/parse failure).
    """
    system_json = system + (
        "\n\nIMPORTANT: Respond with ONLY a single valid JSON object. "
        "No markdown, no code fences, no commentary."
    )
    text = complete_text(system_json, user, max_tokens=max_tokens, temperature=temperature)
    return _parse_json(text)
