"""
action_plan.py

Module A: Personalized Action Plan endpoints.

GET /api/visa/action-plan             → plan for the user's latest readiness check
GET /api/visa/action-plan/{check_id}  → plan for a specific check

The plan is derived on the fly from the stored VisaCheck (plus the matching
VisaFile checklist, if one exists) — no new table. Always scoped to the
authenticated user. (Router conventions mirror routers/visa_file.py.)
"""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.base import AuthUser
from database import get_db
from limiter import limiter
from models import VisaCheck, VisaFile
from services.user_service import get_user_by_auth_id, get_or_create_user
from services.profile_service import get_profile
from services.action_plan_engine import build_plan

logger = logging.getLogger(__name__)
router = APIRouter()


async def _resolve_db_user(db: AsyncSession, current_user: AuthUser):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        db_user = await get_or_create_user(db, current_user.user_id, current_user.email)
    return db_user


async def _latest_check(db: AsyncSession, user) -> VisaCheck | None:
    result = await db.execute(
        select(VisaCheck)
        .where(VisaCheck.user_id == user.id)
        .order_by(VisaCheck.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _check_by_id(db: AsyncSession, user, check_id: str) -> VisaCheck | None:
    result = await db.execute(
        select(VisaCheck).where(
            VisaCheck.id == check_id,
            VisaCheck.user_id == user.id,
        )
    )
    return result.scalar_one_or_none()


async def _file_items_for_check(db: AsyncSession, user, check: VisaCheck) -> list[dict]:
    """Return the checklist items of the VisaFile built from this check, if any."""
    result = await db.execute(
        select(VisaFile).where(
            VisaFile.visa_check_id == check.id,
            VisaFile.user_id == user.id,
        )
    )
    file = result.scalar_one_or_none()
    if file is None or not isinstance(file.items, list):
        return []
    return file.items


def _check_to_dict(check: VisaCheck) -> dict:
    """Shape a VisaCheck row into the dict the engine expects."""
    return {
        "critical_blockers": check.critical_blockers or [],
        "high_risk_flags":   check.high_risk_flags   or [],
        "soft_warnings":     check.soft_warnings      or [],
        "warnings":          check.warnings           or [],
    }


def _counts(steps: list[dict]) -> dict:
    counts = {"critical": 0, "high": 0, "soft": 0, "todo": 0}
    for s in steps:
        counts[s["severity"]] = counts.get(s["severity"], 0) + 1
    return counts


async def _build_response(db: AsyncSession, user, check: VisaCheck) -> dict:
    profile = await get_profile(db, user)
    file_items = await _file_items_for_check(db, user, check)
    steps = build_plan(_check_to_dict(check), profile, file_items)
    return {
        "check_id":           str(check.id),
        "country":            check.country,
        "score":             check.score,
        "result":             check.result,
        "result_description": check.result_description or "",
        "steps":              steps,
        "counts":             _counts(steps),
    }


# ---------------------------------------------------------------------------
# GET /  (latest check)
# ---------------------------------------------------------------------------

@router.get("")
@limiter.limit("60/minute")
async def get_latest_action_plan(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)
    check = await _latest_check(db, db_user)
    if check is None:
        return JSONResponse(
            status_code=404,
            content={"error": "No readiness check yet. Run the checker first."},
        )
    try:
        return JSONResponse(content=await _build_response(db, db_user, check))
    except Exception:
        logger.exception("Failed to build action plan for auth_user_id=%s", current_user.user_id)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to build your action plan. Please try again."},
        )


# ---------------------------------------------------------------------------
# GET /{check_id}
# ---------------------------------------------------------------------------

@router.get("/{check_id}")
@limiter.limit("60/minute")
async def get_action_plan_for_check(
    request: Request,
    check_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)
    check = await _check_by_id(db, db_user, check_id)
    if check is None:
        return JSONResponse(status_code=404, content={"error": "Readiness check not found."})
    try:
        return JSONResponse(content=await _build_response(db, db_user, check))
    except Exception:
        logger.exception("Failed to build action plan for check=%s", check_id)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to build your action plan. Please try again."},
        )
