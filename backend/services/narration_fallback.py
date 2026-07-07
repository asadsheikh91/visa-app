"""
services/narration_fallback.py

Constraint #5: the deterministic fallback narrator. When Gemini is unavailable,
errors, times out, or returns invalid/off-schema output, the report STILL
generates using templated prose assembled here — no LLM call. The report is fully
valid and the numbers/findings/severities are unchanged (they come from the
engine, never from narration).

These templates never invent a figure: they refer to thresholds generically
("the amount stated in the official guidance") and lean on the finding's own
title/rawSignal, so a fallback report makes no numeric claim the engine didn't.
"""

from __future__ import annotations

from schemas.report import GeminiFindingInput, GeminiNarration

# Per-severity "why it matters" prose. Severity is engine-owned; we only phrase it.
_IMPACT_BY_SEVERITY = {
    "critical": (
        "This is a critical issue. Left unresolved it is one of the more common "
        "grounds for refusal, and it should be closed before you submit rather "
        "than explained afterwards."
    ),
    "high": (
        "This is a high-risk item. It may not block your application on its own, "
        "but it materially weakens your file and invites additional scrutiny or "
        "requests for more documents."
    ),
    "medium": (
        "This is worth addressing. It will not usually decide the outcome by "
        "itself, but resolving it strengthens your file and removes an avoidable "
        "weakness."
    ),
}

# Light per-category customization of the fix steps + best practices. The empty
# key is the default used for any category not listed here.
_CATEGORY_FIX = {
    "funds": [
        "Confirm the current required amount for your circumstances on the "
        "official source before you apply.",
        "Make sure the funds are genuinely available and held in line with the "
        "documented history the authority expects to see.",
        "Obtain evidence in the exact format the official guidance specifies.",
    ],
    "language": [
        "Identify the exact score the guidance asks for on an approved test.",
        "Prioritise your weakest ability first — that is where the marginal "
        "improvement is cheapest to earn.",
        "Re-test only once your practice results are consistently at or above the "
        "required level.",
    ],
    "documentation": [
        "List every supporting document the official checklist requires for your "
        "route.",
        "Gather each item in the format and validity window the guidance states.",
        "Verify anything you are unsure about against the official source before "
        "you lodge.",
    ],
    "": [
        "Review the official guidance for this requirement and confirm exactly "
        "what applies to your circumstances.",
        "Gather the specific evidence the guidance asks for, in the required "
        "format.",
        "Re-check the requirement against the official source shortly before you "
        "submit, in case it has changed.",
    ],
}

_BEST_PRACTICES = [
    "Keep a dated copy of every document and the official page you relied on.",
    "Verify each requirement against the official source before you act — rules "
    "and thresholds change.",
]


def _fix_steps(category: str) -> list[str]:
    key = (category or "").strip().lower()
    return list(_CATEGORY_FIX.get(key, _CATEGORY_FIX[""]))


def _explanation(inp: GeminiFindingInput) -> str:
    base = inp.rawSignal.strip() or inp.title.strip()
    # rawSignal is the engine's plain description of what it detected.
    return (
        f"{base} This was flagged from the answers you provided against the "
        "published requirements for your chosen route."
    )


def fallback_narration(inp: GeminiFindingInput) -> GeminiNarration:
    return GeminiNarration(
        id=inp.id,
        explanation=_explanation(inp),
        impact=_IMPACT_BY_SEVERITY.get(inp.severity, _IMPACT_BY_SEVERITY["medium"]),
        fixSteps=_fix_steps(inp.category),
        bestPractices=list(_BEST_PRACTICES),
    )


def fallback_narrations(inputs: list[GeminiFindingInput]) -> list[GeminiNarration]:
    """Deterministic narrations for every input, in input order. Never raises."""
    return [fallback_narration(i) for i in inputs]
