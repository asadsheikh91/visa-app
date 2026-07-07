"""
outcomes.py — Module 3: the outcome loop.

POST /api/visa/outcomes        → report a visa decision (upsert per check)
GET  /api/visa/outcomes        → the user's reported outcomes
GET  /api/visa/outcomes/prompt → should we ask this user to report yet?
GET  /api/visa/outcomes/stats  → approval-rate-by-readiness across all users

The decision (approved/refused) is snapshotted with the check's score so the
analytics survive deletion of the underlying check.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.base import AuthUser
from database import get_db
from limiter import limiter
from models import VisaCheck, VisaOutcome, VisaTimeline
from services.user_service import get_user_by_auth_id, get_or_create_user
from services.outcome_service import (
    is_valid_outcome, should_prompt, approval_analytics, TERMINAL_OUTCOMES,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _resolve_db_user(db: AsyncSession, current_user: AuthUser):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        db_user = await get_or_create_user(db, current_user.user_id, current_user.email)
    return db_user


async def _latest_check(db: AsyncSession, user) -> VisaCheck | None:
    result = await db.execute(
        select(VisaCheck).where(VisaCheck.user_id == user.id)
        .order_by(VisaCheck.created_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Report an outcome
# ---------------------------------------------------------------------------

class OutcomeRequest(BaseModel):
    outcome: str
    country: str | None = None
    visa_check_id: str | None = None
    refusal_reasons: list[str] | None = None
    decided_at: str | None = None


@router.post("")
@limiter.limit("20/minute")
async def report_outcome(
    request: Request, body: OutcomeRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    outcome = (body.outcome or "").lower().strip()
    if not is_valid_outcome(outcome):
        return JSONResponse(status_code=400, content={"error": "Invalid outcome."})

    db_user = await _resolve_db_user(db, current_user)

    # Resolve the check to attach to (explicit id, else the latest check).
    check: VisaCheck | None = None
    if body.visa_check_id:
        res = await db.execute(
            select(VisaCheck).where(
                VisaCheck.id == body.visa_check_id, VisaCheck.user_id == db_user.id
            )
        )
        check = res.scalar_one_or_none()
        if check is None:
            return JSONResponse(status_code=404, content={"error": "Readiness check not found."})
    else:
        check = await _latest_check(db, db_user)

    country = (body.country or (check.country if check else None) or "").lower().strip() or None
    score = check.score if check else None

    # Upsert: one outcome per (user, check). If no check, always insert.
    existing: VisaOutcome | None = None
    if check is not None:
        res = await db.execute(
            select(VisaOutcome).where(
                VisaOutcome.user_id == db_user.id, VisaOutcome.visa_check_id == check.id
            )
        )
        existing = res.scalar_one_or_none()

    now = _utc_now()
    if existing is None:
        row = VisaOutcome(
            user_id=db_user.id,
            visa_check_id=check.id if check else None,
            country=country, score=score, outcome=outcome,
            refusal_reasons=body.refusal_reasons if outcome == "refused" else None,
            decided_at=body.decided_at,
            created_at=now, updated_at=now,
        )
        db.add(row)
    else:
        existing.outcome = outcome
        existing.country = country
        existing.score = score
        existing.refusal_reasons = body.refusal_reasons if outcome == "refused" else None
        existing.decided_at = body.decided_at
        existing.updated_at = now
        row = existing

    try:
        await db.commit()
        await db.refresh(row)
    except Exception:
        await db.rollback()
        logger.exception("Failed to persist outcome for %s", current_user.user_id)
        return JSONResponse(status_code=500, content={"error": "Could not save. Please try again."})

    return JSONResponse(content={"id": str(row.id), "outcome": row.outcome})


# ---------------------------------------------------------------------------
# List outcomes
# ---------------------------------------------------------------------------

@router.get("")
@limiter.limit("30/minute")
async def list_outcomes(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        return JSONResponse(content=[])
    res = await db.execute(
        select(VisaOutcome).where(VisaOutcome.user_id == db_user.id)
        .order_by(VisaOutcome.created_at.desc()).limit(20)
    )
    rows = res.scalars().all()
    return JSONResponse(content=[
        {
            "id": str(r.id),
            "visa_check_id": str(r.visa_check_id) if r.visa_check_id else None,
            "country": r.country,
            "score": r.score,
            "outcome": r.outcome,
            "refusal_reasons": r.refusal_reasons or [],
            "decided_at": r.decided_at,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ])


# ---------------------------------------------------------------------------
# Prompt decision
# ---------------------------------------------------------------------------

@router.get("/prompt")
@limiter.limit("60/minute")
async def get_prompt(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        return JSONResponse(content={"should_prompt": False})

    check = await _latest_check(db, db_user)
    if check is None:
        return JSONResponse(content={"should_prompt": False})

    res = await db.execute(
        select(VisaOutcome).where(
            VisaOutcome.user_id == db_user.id, VisaOutcome.visa_check_id == check.id
        )
    )
    existing = res.scalar_one_or_none()
    has_terminal = existing is not None and existing.outcome in TERMINAL_OUTCOMES

    tl_res = await db.execute(
        select(VisaTimeline).where(VisaTimeline.user_id == db_user.id)
    )
    timeline = tl_res.scalar_one_or_none()
    intake = timeline.intake_date if timeline else None

    prompt = should_prompt(check.created_at.date(), has_terminal, intake)
    return JSONResponse(content={
        "should_prompt": prompt,
        "visa_check_id": str(check.id),
        "country": check.country,
        "score": check.score,
    })


# ---------------------------------------------------------------------------
# Aggregate stats (social proof + calibration)
# ---------------------------------------------------------------------------

@router.get("/stats")
@limiter.limit("60/minute")
async def get_stats(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(VisaOutcome.score, VisaOutcome.outcome)
        .where(VisaOutcome.outcome.in_(("approved", "refused")))
    )
    rows = [{"score": score, "outcome": outcome} for score, outcome in res.all()]
    return JSONResponse(content=approval_analytics(rows))
