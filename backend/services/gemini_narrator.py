"""
services/gemini_narrator.py

Constraint #3: schema-locked Gemini narration. Gemini's ONLY job is to rewrite the
four prose fields (explanation, impact, fixSteps, bestPractices) for findings the
deterministic engine already produced. It never originates a fact, a number, a
severity, or the existence of a finding.

How the lock is enforced:
  - Structured-output mode: response_mime_type="application/json" + a responseSchema
    matching {narrations: GeminiNarration[]}. Temperature <= 0.3.
  - The output is parsed with Pydantic extra="forbid" (schemas/report.py), so any
    off-schema field is rejected.
  - The set of returned ids must EXACTLY equal the set of input ids — no missing,
    no extra findings.
  - Every number that appears in the narration must already appear in that
    finding's input (rawSignal / policyContext / title). A "foreign" number ⇒
    reject. This is the mechanical guarantee that Gemini introduces no figures.

Any failure (no key, transport error, timeout, invalid JSON, off-schema, id
mismatch, foreign number) raises NarrationError. The builder catches it and falls
back to deterministic templated prose (constraint #5) — the report NEVER hard-
depends on a live LLM call.

PII (constraint #8): request/response payloads (which contain finding prose) are
NEVER logged. Only finding ids (engine tokens, not PII) and counts are logged.
"""

from __future__ import annotations

import logging
import os
import re
import time

from schemas.report import (
    GeminiFindingInput,
    GeminiNarration,
    GeminiNarrationResponse,
)

logger = logging.getLogger(__name__)

# Bump whenever the SYSTEM_PROMPT or the narration contract changes. Part of the
# report cache key, so a prompt change regenerates narrations.
PROMPT_VERSION = "narrate-v1"

# Flash-tier model. Configurable via GEMINI_MODEL. NOTE: verify the current Flash
# model id against the live Gemini docs when deploying — do not assume this string
# is evergreen.
DEFAULT_MODEL = "gemini-2.5-flash"

_TEMPERATURE = 0.3
_TIMEOUT_MS = 15_000
_MAX_ATTEMPTS = 2  # one retry on transient failure

# The narration system prompt — used verbatim as specified for this feature.
SYSTEM_PROMPT = (
    "You are a narration engine for ParchiVisa, a visa readiness self-assessment "
    "tool. You DO NOT assess, score, rank, or advise. A deterministic engine has "
    "already produced the findings. Your only job is to rewrite each finding's "
    "explanation into clear, plain, professional prose for the applicant.\n\n"
    "STRICT RULES:\n"
    "- Use ONLY the facts, numbers, thresholds, severities, and sources present in "
    "the input. Never introduce a number, requirement, date, fee, threshold, or "
    "rule not explicitly provided in policyContext or the finding.\n"
    "- Never change a severity. Never add or remove findings.\n"
    "- Ground every 'impact' and 'fix step' in the provided policyContext. If the "
    "context does not support a statement, do not make it.\n"
    "- Regulatory language: phrase requirements as 'commonly required per [source]' "
    "or 'IRCC guidance indicates'. NEVER issue legal directives ('you must', 'you "
    "are legally required to') and never imply ParchiVisa provides legal or "
    "immigration advice.\n"
    "- Tone: plain, direct, second person, no hype, no false reassurance.\n"
    "- Output ONLY valid JSON matching the schema. No text outside the JSON.\n"
    "For each finding return: explanation (what it is), impact (why it matters), "
    "fixSteps (ordered array), bestPractices (array)."
)


class NarrationError(Exception):
    """Any failure that must trigger the deterministic fallback narrator."""


def get_api_key() -> str:
    return os.getenv("GEMINI_API_KEY", "").strip()


def get_model() -> str:
    return os.getenv("GEMINI_MODEL", "").strip() or DEFAULT_MODEL


def is_available() -> bool:
    """True when a key is configured. Cheap check; never raises."""
    return bool(get_api_key())


_NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)?")


def _numbers(text: str) -> set[str]:
    """Digit-run tokens in `text`, normalized (thousands separators removed)."""
    return {m.group(0).replace(",", "") for m in _NUMBER_RE.finditer(text)}


def _allowed_numbers(inp: GeminiFindingInput) -> set[str]:
    allowed: set[str] = set()
    for chunk in (inp.title, inp.category, inp.rawSignal, *inp.policyContext):
        allowed |= _numbers(chunk)
    return allowed


def _narration_numbers(n: GeminiNarration) -> set[str]:
    nums: set[str] = set()
    for chunk in (n.explanation, n.impact, *n.fixSteps, *n.bestPractices):
        nums |= _numbers(chunk)
    return nums


def _validate(
    narrations: list[GeminiNarration],
    inputs: list[GeminiFindingInput],
) -> None:
    """Raise NarrationError unless every constraint holds. No PII in messages."""
    want_ids = {i.id for i in inputs}
    got_ids = [n.id for n in narrations]

    if len(got_ids) != len(set(got_ids)):
        raise NarrationError("Duplicate finding ids in narration output.")
    if set(got_ids) != want_ids:
        raise NarrationError(
            f"Narration id set mismatch (want {len(want_ids)}, "
            f"got {len(set(got_ids))})."
        )

    by_id = {i.id: i for i in inputs}
    for n in narrations:
        allowed = _allowed_numbers(by_id[n.id])
        foreign = _narration_numbers(n) - allowed
        if foreign:
            # Log the id (engine token, not PII) but NOT the prose.
            raise NarrationError(
                f"Narration for finding {n.id!r} introduced a number not present "
                "in its input."
            )


def _client():
    key = get_api_key()
    if not key:
        raise NarrationError("Gemini is not configured (missing GEMINI_API_KEY).")
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:  # pragma: no cover - SDK is in requirements
        raise NarrationError("The google-genai SDK is not installed.") from exc
    client = genai.Client(
        api_key=key,
        http_options=types.HttpOptions(timeout=_TIMEOUT_MS),
    )
    return client, types


def _build_user_payload(inputs: list[GeminiFindingInput]) -> str:
    """The findings to narrate, as JSON. Kept out of logs (may echo policy text)."""
    import json

    return json.dumps(
        {"findings": [i.model_dump() for i in inputs]},
        ensure_ascii=False,
        separators=(",", ":"),
    )


def narrate(inputs: list[GeminiFindingInput]) -> list[GeminiNarration]:
    """
    Generate narrations for `inputs` via Gemini structured output.

    Returns narrations in input order. Raises NarrationError on ANY problem so the
    caller can fall back deterministically. Makes at most _MAX_ATTEMPTS attempts.
    """
    if not inputs:
        return []

    client, types = _client()
    payload = _build_user_payload(inputs)
    config = types.GenerateContentConfig(
        temperature=_TEMPERATURE,
        response_mime_type="application/json",
        response_schema=GeminiNarrationResponse,
        system_instruction=SYSTEM_PROMPT,
    )

    last_exc: Exception | None = None
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            resp = client.models.generate_content(
                model=get_model(),
                contents=payload,
                config=config,
            )
            text = getattr(resp, "text", None)
            if not text:
                raise NarrationError("Empty response from Gemini.")
            # Parse + schema-lock (extra='forbid' on the Pydantic models).
            parsed = GeminiNarrationResponse.model_validate_json(text)
            _validate(parsed.narrations, inputs)
            # Return in input order for stable, deterministic assembly.
            by_id = {n.id: n for n in parsed.narrations}
            ordered = [by_id[i.id] for i in inputs]
            logger.info(
                "Gemini narration ok: %d findings (attempt %d).",
                len(ordered), attempt,
            )
            return ordered
        except Exception as exc:  # noqa: BLE001 - all failures → fallback
            last_exc = exc
            # Log the failure class + attempt, never the payload/response.
            logger.warning(
                "Gemini narration attempt %d/%d failed: %s",
                attempt, _MAX_ATTEMPTS, type(exc).__name__,
            )
            if attempt < _MAX_ATTEMPTS:
                time.sleep(0.5 * attempt)  # small linear backoff

    raise NarrationError("Gemini narration failed after retries.") from last_exc
