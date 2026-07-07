"""
services/report_builder.py

Assembles a full ReportData from a persisted readiness check, then persists it as
a models.Report (encrypted, tokenised). This is the ONLY place facts and prose are
joined.

Pipeline:
  1. Load the country's questions + scoring (for per-criterion breakdown + titles).
  2. Map the engine's fired issues (critical_blockers / high_risk_flags /
     soft_warnings) → Finding skeletons. Severity is decided by which bucket the
     issue came from — never by the LLM.
  3. Retrieve policyContext per finding from the curated official-source registry
     (services/country_sources) — the honest stand-in for a full RAG layer.
  4. Narrate the four prose fields: Redis cache → Gemini → deterministic fallback.
     The download path never re-narrates (constraint #4/#5).
  5. Stamp templateVersion + promptVersion, build the verdict via the pure
     render_verdict() template library, assemble ReportData.
  6. Fernet-encrypt the full payload (PII) and persist with an unguessable token.

Facts come ONLY from the engine/registry; Gemini writes ONLY the four per-finding
prose fields.
"""

from __future__ import annotations

import asyncio
import logging
import secrets
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Report, User, UserVisaProfile, VisaCheck, utc_now_naive
from schemas.report import (
    Applicant,
    CriterionScore,
    DocumentItem,
    Finding,
    GeminiFindingInput,
    GeminiNarration,
    ReportData,
    RoadmapPhase,
    ScoreBand,
    Source,
)
from services import country_sources, encryption, report_cache
from services.gemini_narrator import PROMPT_VERSION, NarrationError
from services.gemini_narrator import is_available as gemini_available
from services.gemini_narrator import narrate as gemini_narrate
from services.narration_fallback import fallback_narrations
from services.readiness_engine import band_for_score, category_breakdown
from services.report_verdict import TEMPLATE_VERSION, render_verdict
from services.visa_data_service import load_questions, load_scoring, normalize_questions

logger = logging.getLogger(__name__)

VISA_TYPE = "student_visa"

# CriterionScore.fill thresholds (matched to the sample report's colour bands).
_FILL_PASS_MIN = 70
_FILL_WARN_MIN = 50

# 2-letter code for the human-readable report id. Falls back to the first two
# letters of the country if not listed.
_COUNTRY_CODE = {"uk": "UK", "usa": "US", "canada": "CA", "australia": "AU"}

_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun",
           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


class ReportError(Exception):
    """Report cannot be built (e.g. encryption unavailable → surface as 503)."""


# ---------------------------------------------------------------------------
# Small formatting / mapping helpers
# ---------------------------------------------------------------------------

def _fill(score: float) -> str:
    if score >= _FILL_PASS_MIN:
        return "pass"
    if score >= _FILL_WARN_MIN:
        return "warn"
    return "crit"


def _human_day(dt: datetime) -> str:
    return f"{dt.day:02d} {_MONTHS[dt.month - 1]} {dt.year}"


def _human_month(iso_date: str) -> str:
    """'2025-01-15' → 'Jan 2025'. Falls back to the raw string on parse failure."""
    try:
        d = datetime.strptime(iso_date[:10], "%Y-%m-%d")
        return f"{_MONTHS[d.month - 1]} {d.year}"
    except (ValueError, TypeError, IndexError):
        return iso_date or ""


def _country_title(country: str) -> str:
    c = (country or "").strip()
    return {"uk": "United Kingdom", "usa": "United States", "canada": "Canada",
            "australia": "Australia"}.get(c.lower(), c.title())


# ---------------------------------------------------------------------------
# Findings: engine issues → Finding skeletons + Gemini inputs
# ---------------------------------------------------------------------------

def _issue_title(issue: dict, question: dict | None) -> str:
    for key in ("rule", "title"):
        v = issue.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    if question:
        q = question.get("question") or question.get("question_text")
        if isinstance(q, str) and q.strip():
            return q.strip().rstrip("?")
    msg = issue.get("message", "")
    return (msg[:80] + "…") if len(msg) > 80 else (msg or "Finding")


def _issue_category(issue: dict, question: dict | None) -> str:
    # _enrich_issue stores the question's risk_category under "severity".
    cat = issue.get("severity") or (question or {}).get("risk_category") or ""
    cat = str(cat).strip().replace("_", " ")
    return cat.title() if cat else "General"


def _issue_raw_signal(issue: dict, question: dict | None) -> str:
    """The engine's plain description of what it detected — grounds narration."""
    msg = issue.get("message")
    if isinstance(msg, str) and msg.strip():
        return msg.strip()
    if question:
        help_text = question.get("help_text") or question.get("user_help_text")
        if isinstance(help_text, str) and help_text.strip():
            return help_text.strip()
    return _issue_title(issue, question)


def _finding_source(issue: dict, country_meta: dict | None) -> Source:
    url = issue.get("source_url") or (country_meta or {}).get("official_url") or ""
    title = (country_meta or {}).get("authority") or "Official guidance"
    retrieved = _human_month((country_meta or {}).get("last_reviewed", "")) or ""
    return Source(title=title, url=url, retrievedAt=retrieved)


def _policy_context(country: str, category: str, issue: dict) -> list[str]:
    """
    Curated official-source excerpts for this finding — the RAG stand-in.
    Pulls the authority line + any changelog entries whose area matches the
    finding's category. All text is hand-curated in services/country_sources.
    """
    ctx: list[str] = []
    meta = country_sources.get_country_meta(country)
    if meta:
        ctx.append(f"Governing authority: {meta['authority']} ({meta['official_url']}).")

    cat_l = category.lower()
    for entry in (country_sources.get_changelog(country) or []):
        area = str(entry.get("area", "")).lower()
        if area and (area in cat_l or cat_l in area):
            ctx.append(f"{entry['area']}: {entry['summary']} (source: {entry['source_url']})")

    # Always include the engine's own signal so the narrator is grounded even when
    # no changelog entry matches.
    signal = _issue_raw_signal(issue, None)
    if signal:
        ctx.append(f"Detected: {signal}")
    return ctx[:4]


def _build_findings_and_inputs(
    check: VisaCheck,
    question_map: dict,
    country: str,
) -> tuple[list[dict], list[GeminiFindingInput]]:
    """
    Return (finding_skeletons, gemini_inputs) in a stable order:
    critical → high → medium, engine order within each bucket.

    finding_skeletons carry everything EXCEPT the four prose fields (filled by
    narration later). gemini_inputs are the narrator's schema-locked inputs.
    """
    country_meta = country_sources.get_country_meta(country)
    buckets = [
        ("critical", check.critical_blockers or []),
        ("high", check.high_risk_flags or []),
        ("medium", check.soft_warnings or []),
    ]

    skeletons: list[dict] = []
    inputs: list[GeminiFindingInput] = []
    seen_ids: set[str] = set()

    for severity, issues in buckets:
        for idx, issue in enumerate(issues):
            if not isinstance(issue, dict):
                continue
            qid = issue.get("question_id") or f"idx{idx}"
            fid = f"{severity}:{qid}"
            # Guarantee uniqueness even if a qid repeats across buckets.
            base = fid
            n = 1
            while fid in seen_ids:
                n += 1
                fid = f"{base}#{n}"
            seen_ids.add(fid)

            question = question_map.get(qid)
            title = _issue_title(issue, question)
            category = _issue_category(issue, question)
            source = _finding_source(issue, country_meta)
            raw_signal = _issue_raw_signal(issue, question)

            skeletons.append({
                "id": fid,
                "severity": severity,
                "title": title,
                "category": category,
                "source": source,
            })
            inputs.append(GeminiFindingInput(
                id=fid,
                severity=severity,
                title=title,
                category=category,
                rawSignal=raw_signal,
                policyContext=_policy_context(country, category, issue),
            ))
    return skeletons, inputs


# ---------------------------------------------------------------------------
# Narration (cache → Gemini → fallback)
# ---------------------------------------------------------------------------

async def _resolve_narration(
    cache_key: str,
    inputs: list[GeminiFindingInput],
) -> tuple[dict[str, GeminiNarration], bool]:
    """
    Return (narration_by_id, narrated_by_ai).

    Order: Redis cache (AI-quality, deterministic) → live Gemini → deterministic
    fallback. Only successful AI narration is cached (so adding a key later can
    still upgrade a previously-fallback report on its next build).
    """
    if not inputs:
        return {}, False

    cached = report_cache.get_cached_narration(cache_key)
    if cached is not None:
        try:
            narrations = [GeminiNarration.model_validate(n) for n in cached]
            return {n.id: n for n in narrations}, True
        except Exception:  # noqa: BLE001 - corrupt cache entry → recompute
            logger.warning("Ignoring corrupt narration cache entry.")

    if gemini_available():
        try:
            narrations = await asyncio.to_thread(gemini_narrate, inputs)
            report_cache.set_cached_narration(
                cache_key, [n.model_dump() for n in narrations]
            )
            return {n.id: n for n in narrations}, True
        except NarrationError as exc:
            logger.warning("Gemini narration failed (%s); using fallback.", type(exc).__name__)

    narrations = fallback_narrations(inputs)
    return {n.id: n for n in narrations}, False


# ---------------------------------------------------------------------------
# Verdict tier + assembly of the non-finding sections
# ---------------------------------------------------------------------------

def _band_tier(band_label: str, bands: list[dict]) -> str:
    """Map a country-variable band onto a coarse tier by its rank among bands."""
    ordered = sorted(bands, key=lambda b: b.get("min", 0))
    labels = [b.get("label") for b in ordered]
    n = len(ordered)
    try:
        rank = labels.index(band_label)
    except ValueError:
        rank = 0
    frac = rank / (n - 1) if n > 1 else 1.0
    if frac >= 0.75:
        return "ready"
    if frac >= 0.5:
        return "conditional"
    if frac >= 0.25:
        return "high_risk"
    return "critical"


def _roadmap(skeletons: list[dict]) -> list[RoadmapPhase]:
    """Deterministic 3-phase roadmap grouped by severity. Items are finding titles."""
    crit = [s["title"] for s in skeletons if s["severity"] == "critical"]
    high = [s["title"] for s in skeletons if s["severity"] == "high"]
    med = [s["title"] for s in skeletons if s["severity"] == "medium"]

    phases = [
        RoadmapPhase(
            window="0–2 Months", theme="Foundations",
            items=crit or ["Confirm your core eligibility against the official guidance."],
        ),
        RoadmapPhase(
            window="2–5 Months", theme="Close the gaps",
            items=high or ["Strengthen supporting evidence where it is thin."],
        ),
        RoadmapPhase(
            window="5–8 Months", theme="Prepare to submit",
            items=(med + ["Assemble your full document set and re-verify every requirement."]),
        ),
    ]
    return phases


_STATUS_BY_SEVERITY = {
    "critical": ("missing", "Not started"),
    "high": ("pending", "Needs work"),
    "medium": ("pending", "Review"),
}


def _documents(skeletons: list[dict]) -> list[DocumentItem]:
    """
    v1 checklist derived from findings (each finding → the evidence it concerns).
    Deterministic and engine-derived; richer per-document checklist integration is
    a follow-up.
    """
    docs: list[DocumentItem] = []
    seen: set[str] = set()
    for s in skeletons:
        name = s["title"]
        if name in seen:
            continue
        seen.add(name)
        status, label = _STATUS_BY_SEVERITY.get(s["severity"], ("pending", "Review"))
        docs.append(DocumentItem(name=name, purpose=s["category"], status=status, statusLabel=label))
    return docs


def _prep_time(tier: str) -> str:
    return {
        "ready": "1–2 months",
        "conditional": "3–5 months",
        "high_risk": "5–8 months",
        "critical": "6–9 months",
    }.get(tier, "3–6 months")


def _sources(country: str, skeletons: list[dict]) -> list[Source]:
    out: list[Source] = []
    seen: set[str] = set()

    def _add(src: Source) -> None:
        key = src.url or src.title
        if key and key not in seen:
            seen.add(key)
            out.append(src)

    meta = country_sources.get_country_meta(country)
    if meta:
        _add(Source(title=meta["authority"], url=meta["official_url"],
                    retrievedAt=_human_month(meta["last_reviewed"])))
    for entry in (country_sources.get_changelog(country) or []):
        _add(Source(title=f"{meta['authority'] if meta else 'Official'} — {entry['area']}",
                    url=entry["source_url"], retrievedAt=_human_month(entry["date"])))
    for s in skeletons:
        _add(s["source"])
    return out


def _applicant(check: VisaCheck, profile: UserVisaProfile | None) -> Applicant:
    """Map the student profile onto the applicant header. Honest placeholders where
    the student profile has no equivalent field (age/marital/occupation). age=0 is
    the 'unknown' sentinel the template renders as '—'."""
    name = (getattr(profile, "preferred_name", None) or "Applicant").strip() or "Applicant"
    study_level = getattr(profile, "study_level", None) or ""
    dependants = getattr(profile, "dependants", None) or "Not provided"
    return Applicant(
        name=name,
        targetCountry=_country_title(check.country),
        pathway="Student Visa",
        occupationNoc=study_level or "—",
        assessmentDate=_human_day(check.created_at),
        age=0,
        maritalStatus="Not provided",
        dependants=str(dependants),
    )


def _report_id(country: str) -> str:
    cc = _COUNTRY_CODE.get((country or "").lower(), (country or "XX")[:2].upper())
    year = utc_now_naive().year
    suffix = secrets.randbelow(10000)
    return f"PV-{cc}-{year}-{suffix:04d}"


# ---------------------------------------------------------------------------
# Public: build (or return cached) report for a check
# ---------------------------------------------------------------------------

async def build_report(
    db: AsyncSession,
    db_user: User,
    check: VisaCheck,
    profile: UserVisaProfile | None,
) -> Report:
    """
    Build and persist a Report for `check` (owned by `db_user`), or return the
    existing one if an identical build already exists (idempotent by cache key).

    Raises ReportError when the report cannot be built (e.g. PII encryption is not
    configured — the report must never be stored as plaintext).
    """
    if not encryption.is_available():
        raise ReportError(
            "Report generation requires FIELD_ENCRYPTION_KEY (PII is encrypted at rest)."
        )

    country = (check.country or "").lower().strip()

    # 1. Load country data for the breakdown + finding titles.
    raw_questions = load_questions(VISA_TYPE, country)
    scoring = load_scoring(VISA_TYPE, country)
    normalize_questions(raw_questions)  # validates shape; raw kept for scoring fields
    question_map = {
        (q.get("id") or q.get("question_id")): q
        for q in raw_questions
        if (q.get("id") or q.get("question_id"))
    }
    answers = check.normalized_answers or {}

    # 2. Findings + narrator inputs (severity from bucket, never from the LLM).
    skeletons, gemini_inputs = _build_findings_and_inputs(check, question_map, country)

    # 3. Cache key over the exact narration determinants + both versions.
    engine_output = {"findings": [i.model_dump() for i in gemini_inputs]}
    cache_key = report_cache.compute_cache_key(engine_output, TEMPLATE_VERSION, PROMPT_VERSION)

    # 4. Idempotency: identical build for this user already exists → return it.
    existing = await db.execute(
        select(Report).where(Report.user_id == db_user.id, Report.cache_key == cache_key)
    )
    row = existing.scalars().first()
    if row is not None:
        return row

    # 5. Narrate (cache → Gemini → fallback).
    narration_by_id, narrated_by_ai = await _resolve_narration(cache_key, gemini_inputs)

    # 6. Merge prose into findings.
    findings: list[Finding] = []
    for s in skeletons:
        n = narration_by_id.get(s["id"])
        if n is None:  # defensive — fallback always covers every id
            n = fallback_narrations([
                GeminiFindingInput(id=s["id"], severity=s["severity"], title=s["title"],
                                   category=s["category"], rawSignal=s["title"], policyContext=[])
            ])[0]
        findings.append(Finding(
            id=s["id"], severity=s["severity"], title=s["title"], category=s["category"],
            explanation=n.explanation, impact=n.impact, fixSteps=n.fixSteps,
            bestPractices=n.bestPractices, source=s["source"],
        ))

    # 7. Criteria breakdown + bands + verdict.
    criteria_raw = category_breakdown(raw_questions, scoring, answers)
    criteria = [
        CriterionScore(key=c["category_id"], label=c["label"], sublabel=c["sublabel"],
                       score=c["score"], fill=_fill(c["score"]))
        for c in criteria_raw
    ]
    score_bands = scoring.get("score_bands", [])
    bands = [ScoreBand(label=b["label"], min=b["min"], max=b["max"])
             for b in sorted(score_bands, key=lambda b: b.get("min", 0))]
    overall = float(check.score)
    # The band shown on the report (badge, meter highlight, verdict tier) is
    # derived from the score at render time via the single source of truth —
    # never read from a stored label that could have diverged from the score.
    band_label = band_for_score(overall, score_bands)["label"] if score_bands else check.result
    if band_label != check.result:
        logger.warning(
            "Check %s: stored result %r disagrees with band for score %s (%r); "
            "rendering the score-derived band. Run scripts/remediate_band_mismatch.py "
            "to fix the stored row.",
            check.id, check.result, overall, band_label,
        )
    tier = _band_tier(band_label, score_bands)
    crit_count = sum(1 for s in skeletons if s["severity"] == "critical")
    high_count = sum(1 for s in skeletons if s["severity"] == "high")
    verdict_lead, crs_note = render_verdict(tier, crit_count, high_count, None, None)

    meta = country_sources.get_country_meta(country)
    data_current = _human_month(meta["last_reviewed"]) if meta else _human_month(
        utc_now_naive().strftime("%Y-%m-%d"))

    report_id = _report_id(country)
    report_data = ReportData(
        reportId=report_id,
        issuedAt=_human_day(utc_now_naive()),
        dataCurrentAs=data_current,
        applicant=_applicant(check, profile),
        overallScore=overall,
        band=band_label,
        bandPositionPct=max(0.0, min(100.0, overall)),
        bands=bands,
        verdictLead=verdict_lead,
        crsNote=crs_note,
        criteria=criteria,
        estCrs=None,  # student-visa pathway — CRS is not applicable
        findings=findings,
        roadmap=_roadmap(skeletons),
        documents=_documents(skeletons),
        prepTime=_prep_time(tier),
        costRange="See official fee schedules",  # honest until per-country cost data is wired
        sources=_sources(country, skeletons),
        templateVersion=TEMPLATE_VERSION,
        promptVersion=PROMPT_VERSION,
    )

    # 8. Encrypt the full payload (PII) and persist with an unguessable token.
    envelope = encryption.encrypt_json(report_data.model_dump())
    report = Report(
        id=uuid.uuid4(),
        user_id=db_user.id,
        visa_check_id=check.id,
        report_id=report_id,
        token=secrets.token_urlsafe(32),
        cache_key=cache_key,
        template_version=TEMPLATE_VERSION,
        prompt_version=PROMPT_VERSION,
        narrated_by_ai=narrated_by_ai,
        data_encrypted=envelope,
    )
    db.add(report)
    try:
        await db.commit()
        await db.refresh(report)
    except Exception:
        await db.rollback()
        raise
    return report


def decrypt_report_data(report: Report) -> dict:
    """Decrypt a persisted Report's payload back to a ReportData dict (for the API)."""
    return encryption.decrypt_json(report.data_encrypted)
