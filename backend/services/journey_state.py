"""
journey_state.py — async aggregation of a user's journey state.

Separated from journey_service (which stays pure) so both the journey router and
the consultant roster (Module 5) can gather a user's state the same way and feed
it to journey_service.build_journey.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    User, VisaCheck, VisaFile, UserDocument, InterviewSession, VisaOutcome,
)
from services.profile_service import get_profile
from services.checklist_engine import RESOLVED_STATUSES
from services.outcome_service import TERMINAL_OUTCOMES


async def gather_journey_state(db: AsyncSession, user: User) -> dict:
    """Collect the flat state dict that journey_service.build_journey consumes."""
    profile = await get_profile(db, user)

    res = await db.execute(
        select(VisaCheck).where(VisaCheck.user_id == user.id)
        .order_by(VisaCheck.created_at.desc()).limit(1)
    )
    check = res.scalar_one_or_none()

    state: dict = {
        "onboarding_completed": bool(profile.onboarding_completed) if profile else False,
        "has_check": check is not None,
    }

    if check is not None:
        state["check_score"] = check.score
        state["critical_blockers"] = len(check.critical_blockers or [])
        state["high_risk_flags"] = len(check.high_risk_flags or [])

        fres = await db.execute(
            select(VisaFile).where(
                VisaFile.user_id == user.id, VisaFile.visa_check_id == check.id
            )
        )
        vfile = fres.scalar_one_or_none()
        if vfile and vfile.items:
            items = vfile.items
            state["checklist_total"] = len(items)
            state["checklist_critical_missing"] = sum(
                1 for it in items
                if it.get("priority") == "critical" and it.get("status") not in RESOLVED_STATUSES
            )

        ores = await db.execute(
            select(VisaOutcome).where(
                VisaOutcome.user_id == user.id, VisaOutcome.visa_check_id == check.id
            )
        )
        outcome = ores.scalar_one_or_none()
        if outcome and outcome.outcome in TERMINAL_OUTCOMES:
            state["outcome"] = outcome.outcome

    dres = await db.execute(
        select(UserDocument).where(
            UserDocument.user_id == user.id,
            UserDocument.doc_type == "financial_statement",
            UserDocument.status == "evaluated",
        ).order_by(UserDocument.created_at.desc()).limit(1)
    )
    doc = dres.scalar_one_or_none()
    if doc and doc.result:
        state["financial_status"] = (doc.result or {}).get("overall_status")

    ires = await db.execute(
        select(InterviewSession.id).where(
            InterviewSession.user_id == user.id,
            InterviewSession.status == "completed",
        ).limit(1)
    )
    state["interview_completed"] = ires.first() is not None

    return state
