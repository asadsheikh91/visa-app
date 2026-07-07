"""
timeline.py

Timeline & Deadline Planner endpoints (Module C).

GET   /api/visa/timeline             → the user's timeline (404 if none yet)
POST  /api/visa/timeline             → generate/regenerate from intake + country
PATCH /api/visa/timeline/milestone   → edit one milestone's status/note

Always scoped to the authenticated user. (Conventions mirror routers/visa_file.py.)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.base import AuthUser
from database import get_db
from limiter import limiter
from services.user_service import get_user_by_auth_id, get_or_create_user
from services.profile_service import get_profile
from services.timeline_service import (
    get_timeline,
    create_or_replace,
    update_milestone,
    serialize_timeline,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class GenerateTimelineRequest(BaseModel):
    intake_date: str                       # ISO YYYY-MM-DD (required)
    country: Optional[str] = None          # falls back to profile.primary_country


class MilestoneUpdateRequest(BaseModel):
    milestone_id: str
    status: Optional[str] = None
    note: Optional[str] = None


async def _resolve_db_user(db: AsyncSession, current_user: AuthUser):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        db_user = await get_or_create_user(db, current_user.user_id, current_user.email)
    return db_user


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------

@router.get("")
@limiter.limit("60/minute")
async def get_my_timeline(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)
    timeline = await get_timeline(db, db_user)
    if timeline is None:
        return JSONResponse(
            status_code=404,
            content={"error": "No timeline yet. Set your intake date to generate one."},
        )
    return JSONResponse(content=serialize_timeline(timeline))


# ---------------------------------------------------------------------------
# POST /  (generate / regenerate)
# ---------------------------------------------------------------------------

@router.post("")
@limiter.limit("30/minute")
async def generate_my_timeline(
    request: Request,
    body: GenerateTimelineRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)

    country = body.country
    if not country:
        profile = await get_profile(db, db_user)
        country = profile.primary_country if profile else None
    if not country:
        return JSONResponse(
            status_code=400,
            content={"error": "No destination country. Pick one or complete your profile first."},
        )

    try:
        timeline = await create_or_replace(db, db_user, country, body.intake_date)
    except ValueError as exc:
        await db.rollback()
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except Exception:
        await db.rollback()
        logger.exception("Failed to build timeline for auth_user_id=%s", current_user.user_id)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to build your timeline. Please try again."},
        )

    return JSONResponse(content=serialize_timeline(timeline))


# ---------------------------------------------------------------------------
# PATCH /milestone
# ---------------------------------------------------------------------------

@router.patch("/milestone")
@limiter.limit("120/minute")
async def patch_milestone(
    request: Request,
    body: MilestoneUpdateRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)
    timeline = await get_timeline(db, db_user)
    if timeline is None:
        return JSONResponse(status_code=404, content={"error": "No timeline found."})

    try:
        timeline = await update_milestone(
            db, timeline, body.milestone_id, body.status, body.note
        )
    except ValueError as exc:
        await db.rollback()
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except Exception:
        await db.rollback()
        logger.exception("Failed to update milestone on timeline for %s", current_user.user_id)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to update the milestone. Please try again."},
        )

    return JSONResponse(content=serialize_timeline(timeline))
