"""
services/admin_service.py

Read-only aggregate queries powering the operator admin panel. Kept separate from
the router so the endpoints stay thin and the SQL is testable in isolation.

Privacy: this module NEVER decrypts financial PII. UserDocument.extracted (the
Fernet envelope of bank-statement details) is summarized, never returned. Report
payloads are decrypted only on the explicit single-report route in the router.
"""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    InterviewSession,
    ReadinessSession,
    Report,
    SopReview,
    User,
    UserDocument,
    UserDocumentState,
    UserVisaProfile,
    VisaCheck,
    VisaOutcome,
)
from services import entitlements


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def _profile_dict(p: UserVisaProfile | None) -> dict | None:
    if p is None:
        return None
    return {
        "preferred_name":        p.preferred_name,
        "applying_from_country": p.applying_from_country,
        "nationality":           p.nationality,
        "applicant_type":        p.applicant_type,
        "interested_countries":  p.interested_countries or [],
        "primary_country":       p.primary_country,
        "study_level":           p.study_level,
        "intended_intake":       p.intended_intake,
        "admission_status":      p.admission_status,
        "funding_source":        p.funding_source,
        "sponsor_relationship":  p.sponsor_relationship,
        "funds_arranged":        p.funds_arranged,
        "bank_statement_status": p.bank_statement_status,
        "previous_refusal":      p.previous_refusal,
        "study_gap":             p.study_gap,
        "dependants":            p.dependants,
        "main_help_needed":      p.main_help_needed or [],
        "onboarding_completed":  p.onboarding_completed,
        "updated_at":            p.updated_at.isoformat() if p.updated_at else None,
    }


def _check_summary(c: VisaCheck) -> dict:
    return {
        "id":                 str(c.id),
        "country":            c.country,
        "visa_type":          c.visa_type,
        "score":              c.score,
        "result":             c.result,
        "result_description": c.result_description or "",
        "created_at":         c.created_at.isoformat(),
    }


def _check_detail(c: VisaCheck) -> dict:
    return {
        **_check_summary(c),
        "critical_blockers":  c.critical_blockers or [],
        "high_risk_flags":    c.high_risk_flags or [],
        "soft_warnings":      c.soft_warnings or [],
        "warnings":           c.warnings or [],
        "recommendations":    c.recommendations or [],
        "normalized_answers": c.normalized_answers or {},
        "sources_used":       c.sources_used or [],
    }


# ---------------------------------------------------------------------------
# Overview / KPIs
# ---------------------------------------------------------------------------

async def _scalar(db: AsyncSession, stmt) -> int:
    return int((await db.execute(stmt)).scalar_one() or 0)


async def get_overview(db: AsyncSession) -> dict:
    """KPI + funnel aggregates for the admin dashboard."""
    registered = await _scalar(db, select(func.count()).select_from(User))
    onboarded = await _scalar(
        db,
        select(func.count())
        .select_from(UserVisaProfile)
        .where(UserVisaProfile.onboarding_completed.is_(True)),
    )

    # Funnel: users who attempted (opened a session OR have a completed check),
    # users with a completed check, users who generated a report.
    users_with_session = select(ReadinessSession.user_id).distinct()
    users_with_check = select(VisaCheck.user_id).distinct()
    attempted = await _scalar(
        db,
        select(func.count()).select_from(
            select(User.id)
            .where(or_(User.id.in_(users_with_session), User.id.in_(users_with_check)))
            .subquery()
        ),
    )
    users_completed = await _scalar(
        db,
        select(func.count()).select_from(users_with_check.subquery()),
    )
    users_with_report = await _scalar(
        db,
        select(func.count()).select_from(select(Report.user_id).distinct().subquery()),
    )

    total_checks = await _scalar(db, select(func.count()).select_from(VisaCheck))
    total_reports = await _scalar(db, select(func.count()).select_from(Report))

    sessions_started = await _scalar(db, select(func.count()).select_from(ReadinessSession))
    sessions_completed = await _scalar(
        db,
        select(func.count()).select_from(ReadinessSession).where(ReadinessSession.status == "completed"),
    )
    sessions_abandoned = max(0, sessions_started - sessions_completed)

    # Plan breakdown.
    plan_rows = (await db.execute(
        select(User.plan, func.count()).group_by(User.plan)
    )).all()
    plan_breakdown = {(plan or "free"): int(count) for plan, count in plan_rows}

    # Outcome breakdown (self-reported decisions).
    outcome_rows = (await db.execute(
        select(VisaOutcome.outcome, func.count()).group_by(VisaOutcome.outcome)
    )).all()
    outcome_breakdown = {(o or "unknown"): int(count) for o, count in outcome_rows}

    return {
        "registered_users":     registered,
        "onboarded_users":      onboarded,
        "users_attempted":      attempted,
        "users_completed_check": users_completed,
        "users_with_report":    users_with_report,
        "total_checks":         total_checks,
        "total_reports":        total_reports,
        "sessions_started":     sessions_started,
        "sessions_completed":   sessions_completed,
        "sessions_abandoned":   sessions_abandoned,
        "plan_breakdown":       plan_breakdown,
        "outcome_breakdown":    outcome_breakdown,
        "funnel": [
            {"stage": "Registered",        "count": registered},
            {"stage": "Onboarded",         "count": onboarded},
            {"stage": "Attempted a check", "count": attempted},
            {"stage": "Completed a check", "count": users_completed},
            {"stage": "Generated a report", "count": users_with_report},
        ],
    }


# ---------------------------------------------------------------------------
# User directory
# ---------------------------------------------------------------------------

async def _counts_by_user(db: AsyncSession, model, user_ids: list) -> dict:
    if not user_ids:
        return {}
    rows = (await db.execute(
        select(model.user_id, func.count())
        .where(model.user_id.in_(user_ids))
        .group_by(model.user_id)
    )).all()
    return {uid: int(count) for uid, count in rows}


async def list_users(
    db: AsyncSession,
    search: str | None = None,
    plan: str | None = None,
    limit: int = 25,
    offset: int = 0,
) -> dict:
    """Paginated user directory with per-user check/report counts (no N+1)."""
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    filters = []
    if search:
        like = f"%{search.strip().lower()}%"
        filters.append(func.lower(User.email).like(like))
    if plan:
        filters.append(User.plan == plan)

    base = select(User)
    if filters:
        base = base.where(*filters)

    total = await _scalar(
        db, select(func.count()).select_from(base.subquery())
    )

    page = (await db.execute(
        base.order_by(User.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all()

    user_ids = [u.id for u in page]
    check_counts = await _counts_by_user(db, VisaCheck, user_ids)
    report_counts = await _counts_by_user(db, Report, user_ids)

    # Onboarding flags for the page in one query.
    prof_rows = (await db.execute(
        select(UserVisaProfile.user_id, UserVisaProfile.onboarding_completed, UserVisaProfile.preferred_name)
        .where(UserVisaProfile.user_id.in_(user_ids))
    )).all() if user_ids else []
    prof_map = {uid: (bool(done), name) for uid, done, name in prof_rows}

    users = []
    for u in page:
        prof = prof_map.get(u.id, (False, None))
        users.append({
            "id":              str(u.id),
            "email":           u.email,
            "preferred_name":  prof[1],
            "plan":            u.plan,
            "onboarded":       prof[0],
            "checks":          check_counts.get(u.id, 0),
            "reports":         report_counts.get(u.id, 0),
            "check_limit":     u.readiness_check_limit,
            "report_limit":    u.report_limit,
            "created_at":      u.created_at.isoformat(),
        })

    return {"users": users, "total": total, "limit": limit, "offset": offset}


# ---------------------------------------------------------------------------
# User drill-down
# ---------------------------------------------------------------------------

async def get_user_detail(db: AsyncSession, user: User) -> dict:
    """Full per-user drill-down. Financial PII stays masked."""
    profile = (await db.execute(
        select(UserVisaProfile).where(UserVisaProfile.user_id == user.id)
    )).scalar_one_or_none()

    checks = (await db.execute(
        select(VisaCheck).where(VisaCheck.user_id == user.id).order_by(VisaCheck.created_at.desc())
    )).scalars().all()

    reports = (await db.execute(
        select(Report).where(Report.user_id == user.id).order_by(Report.created_at.desc())
    )).scalars().all()

    outcomes = (await db.execute(
        select(VisaOutcome).where(VisaOutcome.user_id == user.id).order_by(VisaOutcome.created_at.desc())
    )).scalars().all()

    fin_docs = (await db.execute(
        select(UserDocument).where(UserDocument.user_id == user.id).order_by(UserDocument.created_at.desc())
    )).scalars().all()

    doc_state_rows = (await db.execute(
        select(UserDocumentState.status, func.count())
        .where(UserDocumentState.user_id == user.id)
        .group_by(UserDocumentState.status)
    )).all()

    sop_count = await _scalar(
        db, select(func.count()).select_from(SopReview).where(SopReview.user_id == user.id)
    )
    interview_count = await _scalar(
        db, select(func.count()).select_from(InterviewSession).where(InterviewSession.user_id == user.id)
    )

    check_limit = entitlements.lifetime_limit_for(user, "readiness_check")
    report_limit = entitlements.lifetime_limit_for(user, "report")

    return {
        "user": {
            "id":            str(user.id),
            "email":         user.email,
            "auth_user_id":  user.auth_user_id,
            "plan":          user.plan,
            "created_at":    user.created_at.isoformat(),
            "readiness_check_limit": user.readiness_check_limit,
            "report_limit":  user.report_limit,
            # Effective (resolved) caps: None means unlimited (paid/admin).
            "effective_check_limit":  check_limit,
            "effective_report_limit": report_limit,
        },
        "profile": _profile_dict(profile),
        "checks":  [_check_summary(c) for c in checks],
        "reports": [
            {
                "id":            str(r.id),
                "report_id":     r.report_id,
                "visa_check_id": str(r.visa_check_id) if r.visa_check_id else None,
                "narrated_by_ai": r.narrated_by_ai,
                "created_at":    r.created_at.isoformat(),
            }
            for r in reports
        ],
        "outcomes": [
            {
                "id":         str(o.id),
                "country":    o.country,
                "score":      o.score,
                "outcome":    o.outcome,
                "decided_at": o.decided_at,
                "created_at": o.created_at.isoformat(),
            }
            for o in outcomes
        ],
        "usage": {
            "checks":              len(checks),
            "reports":             len(reports),
            "sop_reviews":         sop_count,
            "interview_sessions":  interview_count,
            "financial_documents": len(fin_docs),
        },
        # Masked — bank details are NEVER decrypted here.
        "financial_documents": [
            {
                "id":         str(d.id),
                "doc_type":   d.doc_type,
                "country":    d.country,
                "bank_id":    d.bank_id,
                "status":     d.status,
                "evaluated":  d.result is not None,
                "created_at": d.created_at.isoformat(),
            }
            for d in fin_docs
        ],
        "document_progress": {status: int(count) for status, count in doc_state_rows},
    }


async def get_user_check(db: AsyncSession, user: User, check_id: str) -> dict | None:
    """One of the user's checks with full answers + result, or None."""
    try:
        result = await db.execute(select(VisaCheck).where(VisaCheck.id == check_id))
        check = result.scalar_one_or_none()
    except Exception:
        return None
    if check is None or check.user_id != user.id:
        return None
    return _check_detail(check)


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    try:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
    except Exception:
        return None
