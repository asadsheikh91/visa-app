"""
sop.py

Statement-of-Purpose reviewer endpoints (Module E).

POST /api/visa/sop/review    → AI review of a pasted SOP (quota-limited)
GET  /api/visa/sop/history   → the user's recent reviews (summaries)

Degrades gracefully: returns 503 when no ANTHROPIC_API_KEY is configured, 502 on
a provider failure, 429 when the daily free quota is exhausted.
"""

import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.base import AuthUser
from database import get_db
from limiter import limiter
from models import SopReview
from services.user_service import get_user_by_auth_id, get_or_create_user
from services.profile_service import get_profile
from services.entitlements import check_quota
from services.sop_review_engine import build_review
from services.ai_client import AIUnavailableError, AIError

logger = logging.getLogger(__name__)
router = APIRouter()


class SopReviewRequest(BaseModel):
    sop_text: str
    country: Optional[str] = None


async def _resolve_db_user(db: AsyncSession, current_user: AuthUser):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        db_user = await get_or_create_user(db, current_user.user_id, current_user.email)
    return db_user


@router.post("/review")
@limiter.limit("10/minute")
async def review_sop(
    request: Request,
    body: SopReviewRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)

    # Quota (free plan: N/day). Counts today's SopReview rows.
    allowed, remaining = await check_quota(db, db_user, "sop_review", SopReview)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"error": "You've reached today's free SOP reviews. Please try again tomorrow."},
        )

    country = body.country
    if not country:
        profile = await get_profile(db, db_user)
        country = (profile.primary_country if profile else "") or ""

    try:
        feedback = build_review(body.sop_text, country)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except AIUnavailableError as exc:
        logger.info("SOP review unavailable: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"error": "AI review is not available yet. Please check back soon."},
        )
    except AIError as exc:
        logger.warning("SOP review provider error: %s", exc)
        return JSONResponse(
            status_code=502,
            content={"error": "The AI reviewer is temporarily unavailable. Please try again."},
        )

    # Persist (hash only — never the SOP text).
    text = (body.sop_text or "").strip()
    review = SopReview(
        user_id=db_user.id,
        country=country or None,
        input_chars=len(text),
        input_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
        feedback=feedback,
    )
    db.add(review)
    try:
        await db.commit()
        await db.refresh(review)
    except Exception:
        await db.rollback()
        logger.exception("Failed to persist SOP review for %s", current_user.user_id)
        # The review still succeeded — return it without the id.
        return JSONResponse(content={"id": None, "feedback": feedback, "remaining": max(0, remaining - 1)})

    return JSONResponse(content={
        "id":        str(review.id),
        "feedback":  feedback,
        "remaining": max(0, remaining - 1),
        "created_at": review.created_at.isoformat(),
    })


@router.get("/history")
@limiter.limit("30/minute")
async def sop_history(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        return JSONResponse(content=[])

    result = await db.execute(
        select(SopReview)
        .where(SopReview.user_id == db_user.id)
        .order_by(SopReview.created_at.desc())
        .limit(10)
    )
    reviews = result.scalars().all()
    return JSONResponse(content=[
        {
            "id":            str(r.id),
            "country":       r.country,
            "input_chars":   r.input_chars,
            "overall_score": (r.feedback or {}).get("overall_score", 0),
            "verdict":       (r.feedback or {}).get("verdict", ""),
            "created_at":    r.created_at.isoformat(),
        }
        for r in reviews
    ])
