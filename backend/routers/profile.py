"""
profile.py

User visa-profile endpoints.

GET  /api/user/profile  → 200 with profile dict, or 404 if no profile exists yet
POST /api/user/profile  → create-or-update profile, 200 with updated profile dict

The profile is always tied to the authenticated user — no ID in the path.
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
from services.profile_service import get_profile, upsert_profile

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schema
# ---------------------------------------------------------------------------

class ProfileUpdate(BaseModel):
    preferred_name:         Optional[str]       = None
    applying_from_country:  Optional[str]       = None
    nationality:            Optional[str]       = None
    applicant_type:         Optional[str]       = None
    interested_countries:   Optional[list[str]] = None
    primary_country:        Optional[str]       = None
    study_level:            Optional[str]       = None
    intended_intake:        Optional[str]       = None
    admission_status:       Optional[str]       = None
    funding_source:         Optional[str]       = None
    sponsor_relationship:   Optional[str]       = None
    funds_arranged:         Optional[str]       = None
    bank_statement_status:  Optional[str]       = None
    previous_refusal:       Optional[str]       = None
    study_gap:              Optional[str]       = None
    dependants:             Optional[str]       = None
    main_help_needed:       Optional[list[str]] = None
    onboarding_completed:   Optional[bool]      = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _profile_dict(profile) -> dict:
    return {
        "preferred_name":        profile.preferred_name,
        "applying_from_country": profile.applying_from_country,
        "nationality":           profile.nationality,
        "applicant_type":        profile.applicant_type,
        "interested_countries":  profile.interested_countries or [],
        "primary_country":       profile.primary_country,
        "study_level":           profile.study_level,
        "intended_intake":       profile.intended_intake,
        "admission_status":      profile.admission_status,
        "funding_source":        profile.funding_source,
        "sponsor_relationship":  profile.sponsor_relationship,
        "funds_arranged":        profile.funds_arranged,
        "bank_statement_status": profile.bank_statement_status,
        "previous_refusal":      profile.previous_refusal,
        "study_gap":             profile.study_gap,
        "dependants":            profile.dependants,
        "main_help_needed":      profile.main_help_needed or [],
        "onboarding_completed":  profile.onboarding_completed,
    }


async def _resolve_db_user(db, current_user: AuthUser):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        db_user = await get_or_create_user(db, current_user.user_id, current_user.email)
    return db_user


# ---------------------------------------------------------------------------
# GET /api/user/profile
# ---------------------------------------------------------------------------

@router.get("/profile")
@limiter.limit("60/minute")
async def get_user_profile(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)
    profile = await get_profile(db, db_user)
    if profile is None:
        return JSONResponse(status_code=404, content={"error": "No profile found."})
    return JSONResponse(content=_profile_dict(profile))


# ---------------------------------------------------------------------------
# POST /api/user/profile
# ---------------------------------------------------------------------------

@router.post("/profile")
@limiter.limit("30/minute")
async def save_user_profile(
    request: Request,
    body: ProfileUpdate,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)

    data = body.model_dump(exclude_none=True)

    try:
        profile = await upsert_profile(db, db_user, data)
    except Exception:
        await db.rollback()
        logger.exception(
            "Failed to upsert profile for auth_user_id=%s", current_user.user_id
        )
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to save profile. Please try again."},
        )

    return JSONResponse(content=_profile_dict(profile))
