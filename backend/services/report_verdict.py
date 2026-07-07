"""
services/report_verdict.py

The reviewed template library for the report's engine-authored prose: the verdict
summary paragraph (`verdictLead`) and the CRS callout sentence (`crsNote`).

Design constraints (as specified for this feature):
  - PURE function. No I/O, no LLM, deterministic.
  - Explicit branches per band tier and per severity mix — NOT inline string
    concatenation of runtime values. Every sentence is chosen from this vetted
    library.
  - No runtime interpolation of UNVALIDATED / free-text values. The only values
    substituted are: validated small integers (finding counts, rendered as words
    via _count_phrase) and curated data (the band label from scoring.json, a
    validated estCrs number, and a curated cutoff-context string). Applicant PII
    and any LLM output are NEVER interpolated here.
  - Wording is versioned by TEMPLATE_VERSION, which is part of the narration cache
    key — so changing any sentence below busts the cache and regenerates reports.

Gemini's scope is strictly the four per-finding prose fields; it never authors the
verdict or CRS text. See services/gemini_narrator.py.
"""

from __future__ import annotations

from typing import Literal, Optional

# Bump on ANY wording change below (it is part of the report cache key).
TEMPLATE_VERSION = "verdict-v1"

# Coarse band tiers the verdict branches on. The builder maps a country-variable
# band (its rank among that country's sorted score_bands) onto one of these, so
# the template library stays stable across countries.
BandTier = Literal["ready", "conditional", "high_risk", "critical"]

_ONES = ("zero", "one", "two", "three", "four", "five", "six",
         "seven", "eight", "nine", "ten")


def _count_phrase(n: int, singular: str, plural: str) -> str:
    """'one critical gap' / 'three critical gaps' / '12 critical gaps'. Validated int only."""
    word = _ONES[n] if 0 <= n <= 10 else str(n)
    noun = singular if n == 1 else plural
    return f"{word} {noun}"


def render_verdict(
    band_tier: BandTier,
    critical_count: int,
    high_count: int,
    est_crs: Optional[float],
    cutoff_context: Optional[str],
) -> tuple[str, str]:
    """
    Return (verdict_lead, crs_note).

    band_tier      — coarse readiness tier (mapped from the engine band upstream).
    critical_count — number of critical findings (engine-derived, validated int).
    high_count     — number of high findings (engine-derived, validated int).
    est_crs        — CRS estimate when applicable (e.g. Canada Express Entry),
                     else None. For student-visa pathways this is None and
                     crs_note is "".
    cutoff_context — curated phrase describing recent cutoffs (e.g. "the low-500s"),
                     or None to omit that clause.
    """
    lead = _render_lead(band_tier, critical_count, high_count)
    crs = _render_crs(est_crs, cutoff_context)
    return lead, crs


def _render_lead(band_tier: BandTier, critical_count: int, high_count: int) -> str:
    has_critical = critical_count > 0
    has_high = high_count > 0

    if band_tier == "ready":
        if has_critical:
            # Rare: capped band still shows criticals — be honest about the gap.
            return (
                "Your profile is broadly strong, but "
                f"{_count_phrase(critical_count, 'critical issue', 'critical issues')} "
                "must be resolved before you submit — do not treat the headline "
                "score as clearance while it stands."
            )
        if has_high:
            return (
                "Your profile is competitive. A small number of high-risk items "
                "remain; clearing them removes the most likely grounds for "
                "additional checks before you lodge."
            )
        return (
            "Your profile is competitive and submission-ready on the criteria "
            "assessed here. Review every document once more, then proceed with "
            "confidence."
        )

    if band_tier == "conditional":
        if has_critical:
            return (
                "You have a viable pathway, but you are not yet competitive. "
                f"{_count_phrase(critical_count, 'critical gap', 'critical gaps').capitalize()} "
                "must be closed before you submit — they currently place you below "
                "the standard recent applications are held to."
            )
        return (
            "You have a viable pathway, but you are not yet competitive. Several "
            "items below weaken your file; strengthening them is the fastest route "
            "to a submission-ready profile."
        )

    if band_tier == "high_risk":
        if has_critical:
            return (
                "Your file carries a high risk of refusal as it stands. "
                f"{_count_phrase(critical_count, 'critical issue', 'critical issues').capitalize()} "
                "would very likely lead to a refusal if you submitted today — treat "
                "the roadmap below as prerequisites, not suggestions."
            )
        return (
            "Your file carries a high risk of refusal as it stands. Work through "
            "every flagged item below before you consider lodging; submitting now "
            "would put your application at avoidable risk."
        )

    # critical
    return (
        "Your file is not ready to submit. "
        f"{_count_phrase(max(critical_count, 1), 'critical blocker', 'critical blockers').capitalize()} "
        "must be resolved first — an application lodged in this state is very "
        "likely to be refused. Start with the roadmap below."
    )


def _render_crs(est_crs: Optional[float], cutoff_context: Optional[str]) -> str:
    if est_crs is None:
        return ""  # Not an Express-Entry-style pathway (e.g. student visa).

    crs = int(round(est_crs))
    if cutoff_context:
        return (
            f"Your estimated Comprehensive Ranking System score is {crs}. Recent "
            f"draws have invited candidates from {cutoff_context}. Closing the "
            "language and credential gaps below is the fastest route to a "
            "competitive score."
        )
    return (
        f"Your estimated Comprehensive Ranking System score is {crs}. Closing the "
        "gaps identified below is the fastest route to a competitive score; "
        "confirm the current draw cutoffs against the official source before you "
        "act."
    )
