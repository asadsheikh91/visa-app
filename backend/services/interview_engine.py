"""
interview_engine.py

Module F: Mock credibility-interview simulator.

Pure functions over the AI client — no DB. The router owns the session/transcript.

A transcript is a list of turns: [{"role": "interviewer"|"student", "content": str}].
`next_question` produces the officer's next question; `assess` produces a final
structured credibility assessment.

Raises:
  AIUnavailableError    — no API key configured (router → 503)
  AIError               — provider/parse failure (router → 502)
"""

import logging

from services import ai_client
from services.country_sources import COUNTRY_AUTHORITY

logger = logging.getLogger(__name__)

MAX_QUESTIONS = 10   # router-enforced cap to keep sessions bounded


def _country_label(country: str) -> str:
    meta = COUNTRY_AUTHORITY.get((country or "").lower().strip())
    return meta["authority"] if meta else "a student-visa"


def _interview_system(country: str) -> str:
    label = _country_label(country)
    return (
        f"You are a {label} visa interview officer conducting a realistic mock "
        "credibility interview with a prospective international student.\n\n"
        "Rules:\n"
        "- Ask ONE question at a time, like a real officer.\n"
        "- Cover, over the interview: course and university choice, why this "
        "country, finances and who funds the study, ties and intentions to return "
        "home, and post-study plans.\n"
        "- Adapt to the candidate's previous answers; probe vague, generic, or "
        "inconsistent answers with a sharper follow-up.\n"
        "- Keep each question concise (one or two sentences).\n"
        "- Do NOT give feedback or commentary during the interview. Output ONLY "
        "the next question text — no numbering, no preamble."
    )


def _to_messages(transcript: list[dict]) -> list[dict]:
    """Map the transcript to Anthropic messages, kicked off by a user turn."""
    messages = [{"role": "user", "content": "Please begin the mock interview with your first question."}]
    for turn in transcript:
        role = "assistant" if turn.get("role") == "interviewer" else "user"
        content = str(turn.get("content") or "").strip()
        if content:
            messages.append({"role": role, "content": content})
    return messages


def next_question(country: str, transcript: list[dict]) -> str:
    """Generate the interviewer's next question given the transcript so far."""
    system = _interview_system(country)
    messages = _to_messages(transcript)
    question = ai_client.complete_messages(system, messages, max_tokens=300, temperature=0.6)
    return question.strip() or "Can you tell me why you chose this course?"


# ---------------------------------------------------------------------------
# Assessment
# ---------------------------------------------------------------------------

def _assess_system(country: str) -> str:
    label = _country_label(country)
    return (
        f"You are a {label} visa officer who has just finished a mock credibility "
        "interview. Assess the candidate's answers the way an officer deciding "
        "genuineness would. Be specific and honest.\n\n"
        "Return a JSON object with this exact shape:\n"
        "{\n"
        '  "overall_score": <int 0-100>,\n'
        '  "verdict": "<one-sentence credibility judgement>",\n'
        '  "strengths": ["<what was convincing>", ...],\n'
        '  "weaknesses": ["<what raised doubt>", ...],\n'
        '  "tips": ["<concrete improvement for the real interview>", ...]\n'
        "}"
    )


def _transcript_to_text(transcript: list[dict]) -> str:
    lines = []
    for turn in transcript:
        who = "Officer" if turn.get("role") == "interviewer" else "Candidate"
        lines.append(f"{who}: {str(turn.get('content') or '').strip()}")
    return "\n".join(lines)


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


def _normalize_assessment(raw: dict) -> dict:
    return {
        "overall_score": _as_int(raw.get("overall_score")),
        "verdict":       str(raw.get("verdict") or "").strip(),
        "strengths":     _as_str_list(raw.get("strengths")),
        "weaknesses":    _as_str_list(raw.get("weaknesses")),
        "tips":          _as_str_list(raw.get("tips")),
    }


def assess(country: str, transcript: list[dict]) -> dict:
    """Produce a normalized final credibility assessment from the transcript."""
    answered = [t for t in transcript if t.get("role") == "student" and str(t.get("content") or "").strip()]
    if not answered:
        raise ValueError("There are no answers to assess yet.")

    system = _assess_system(country)
    raw = ai_client.complete_json(system, _transcript_to_text(transcript),
                                  max_tokens=1500, temperature=0.3)
    return _normalize_assessment(raw)
