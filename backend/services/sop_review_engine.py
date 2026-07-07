"""
sop_review_engine.py

Module E: Statement-of-Purpose reviewer.

Builds a visa-officer-style review prompt, calls the AI client for a structured
JSON assessment, and normalizes the result into a stable contract regardless of
small model variations. No DB — the router owns persistence.

Raises:
  ValueError            — SOP text too short/long (router → 400)
  AIUnavailableError    — no API key configured (router → 503)
  AIError               — provider/parse failure (router → 502)
"""

import logging

from services import ai_client
from services.country_sources import COUNTRY_AUTHORITY

logger = logging.getLogger(__name__)

MIN_CHARS = 200
MAX_CHARS = 15_000

_SECTION_FALLBACK = [
    "Genuine intent",
    "Ties to home country",
    "Study-to-career logic",
    "Financial credibility",
    "Clarity & structure",
]


def _country_label(country: str) -> str:
    meta = COUNTRY_AUTHORITY.get((country or "").lower().strip())
    return meta["authority"] if meta else "the destination country's"


def _build_system_prompt(country: str) -> str:
    label = _country_label(country)
    return (
        "You are an experienced student-visa officer and admissions advisor "
        f"reviewing a Statement of Purpose (SOP) for a student visa assessed by {label}. "
        "Evaluate it exactly as an officer judging whether the applicant is a genuine "
        "student would: clear and consistent study intent, credible study-to-career "
        "logic, strong ties/incentive to return home, financial credibility, and "
        "authentic (non-generic, non-AI-sounding) writing.\n\n"
        "Be specific, honest, and constructive — cite phrases or gaps, don't be generic. "
        "Flag anything that could trigger a refusal.\n\n"
        "Return a JSON object with this exact shape:\n"
        "{\n"
        '  "overall_score": <int 0-100>,\n'
        '  "verdict": "<one-sentence overall judgement>",\n'
        '  "sections": [\n'
        '    {"name": "<aspect>", "score": <int 0-100>, "assessment": "<2-3 sentences>", '
        '"suggestions": ["<concrete fix>", ...]}\n'
        "  ],\n"
        '  "red_flags": ["<refusal-risk issue>", ...],\n'
        '  "rewrite_tips": ["<actionable rewrite tip>", ...]\n'
        "}\n"
        "Cover these aspects as sections: genuine intent, ties to home country, "
        "study-to-career logic, financial credibility, and clarity & structure."
    )


# ---------------------------------------------------------------------------
# Normalization — make the contract stable regardless of model wobble
# ---------------------------------------------------------------------------

def _as_int(value, default=0) -> int:
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):
        return default


def _as_str_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _normalize_sections(raw) -> list[dict]:
    sections: list[dict] = []
    if isinstance(raw, list):
        for s in raw:
            if not isinstance(s, dict):
                continue
            name = str(s.get("name") or "").strip()
            if not name:
                continue
            sections.append({
                "name":        name,
                "score":       _as_int(s.get("score")),
                "assessment":  str(s.get("assessment") or "").strip(),
                "suggestions": _as_str_list(s.get("suggestions")),
            })
    return sections


def _normalize(raw: dict) -> dict:
    return {
        "overall_score": _as_int(raw.get("overall_score")),
        "verdict":       str(raw.get("verdict") or "").strip(),
        "sections":      _normalize_sections(raw.get("sections")),
        "red_flags":     _as_str_list(raw.get("red_flags")),
        "rewrite_tips":  _as_str_list(raw.get("rewrite_tips")),
    }


# ---------------------------------------------------------------------------
# Public engine
# ---------------------------------------------------------------------------

def build_review(sop_text: str, country: str = "", profile=None) -> dict:
    """
    Review an SOP and return the normalized structured assessment.

    Raises ValueError when the text is too short or too long.
    """
    text = (sop_text or "").strip()
    if len(text) < MIN_CHARS:
        raise ValueError(
            f"Your statement is too short to review (minimum {MIN_CHARS} characters)."
        )
    if len(text) > MAX_CHARS:
        raise ValueError(
            f"Your statement is too long (maximum {MAX_CHARS} characters). "
            "Please trim it and try again."
        )

    system = _build_system_prompt(country)
    raw = ai_client.complete_json(system, text, max_tokens=2500, temperature=0.3)
    result = _normalize(raw)

    # If the model returned no usable sections, surface a provider error rather
    # than an empty, useless review.
    if not result["sections"] and result["overall_score"] == 0 and not result["verdict"]:
        raise ai_client.AIError("The AI returned an empty review. Please try again.")

    return result
