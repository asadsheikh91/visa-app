"""
interview.py

Mock credibility-interview endpoints (Module F).

POST /api/visa/interview/start        → start a session (quota-limited)
POST /api/visa/interview/{id}/reply   → answer; get the next question
POST /api/visa/interview/{id}/finish  → end the session; get the assessment

Degrades gracefully: 503 when no ANTHROPIC_API_KEY, 502 on provider failure,
429 when the daily free quota is exhausted.
"""

import logging
from datetime import datetime, timezone
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
from models import InterviewSession
from services.user_service import get_user_by_auth_id, get_or_create_user
from services.profile_service import get_profile
from services.entitlements import check_quota
from services.interview_engine import next_question, assess, MAX_QUESTIONS
from services.ai_client import AIUnavailableError, AIError

logger = logging.getLogger(__name__)
router = APIRouter()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class StartRequest(BaseModel):
    country: Optional[str] = None


class ReplyRequest(BaseModel):
    answer: str


async def _resolve_db_user(db: AsyncSession, current_user: AuthUser):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        db_user = await get_or_create_user(db, current_user.user_id, current_user.email)
    return db_user


async def _session_by_id(db: AsyncSession, user, session_id: str) -> InterviewSession | None:
    result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == session_id,
            InterviewSession.user_id == user.id,
        )
    )
    return result.scalar_one_or_none()


def _ai_error_response(exc: Exception) -> JSONResponse:
    if isinstance(exc, AIUnavailableError):
        logger.info("Interview unavailable: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"error": "AI interviews are not available yet. Please check back soon."},
        )
    logger.warning("Interview provider error: %s", exc)
    return JSONResponse(
        status_code=502,
        content={"error": "The AI interviewer is temporarily unavailable. Please try again."},
    )


def _questions_asked(transcript: list[dict]) -> int:
    return sum(1 for t in transcript if t.get("role") == "interviewer")


def _serialize(session: InterviewSession, *, can_continue: bool | None = None) -> dict:
    out = {
        "id":         str(session.id),
        "country":    session.country,
        "status":     session.status,
        "transcript": session.transcript or [],
        "assessment": session.assessment,
    }
    if can_continue is not None:
        out["can_continue"] = can_continue
    return out


# ---------------------------------------------------------------------------
# POST /start
# ---------------------------------------------------------------------------

@router.post("/start")
@limiter.limit("10/minute")
async def start_interview(
    request: Request,
    body: StartRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)

    allowed, _ = await check_quota(db, db_user, "interview", InterviewSession)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"error": "You've used today's free mock interview. Please try again tomorrow."},
        )

    country = body.country
    if not country:
        profile = await get_profile(db, db_user)
        country = (profile.primary_country if profile else "") or ""

    # Generate the first question BEFORE creating the row, so an AI failure
    # leaves no empty session (and doesn't consume the daily quota).
    try:
        question = next_question(country, [])
    except (AIUnavailableError, AIError) as exc:
        return _ai_error_response(exc)

    now = _utc_now()
    session = InterviewSession(
        user_id=db_user.id,
        country=country or None,
        status="active",
        transcript=[{"role": "interviewer", "content": question}],
        created_at=now,
        updated_at=now,
    )
    db.add(session)
    try:
        await db.commit()
        await db.refresh(session)
    except Exception:
        await db.rollback()
        logger.exception("Failed to create interview session for %s", current_user.user_id)
        return JSONResponse(status_code=500, content={"error": "Failed to start the interview. Please try again."})

    return JSONResponse(content=_serialize(session, can_continue=True))


# ---------------------------------------------------------------------------
# POST /{id}/reply
# ---------------------------------------------------------------------------

@router.post("/{session_id}/reply")
@limiter.limit("30/minute")
async def reply_interview(
    request: Request,
    session_id: str,
    body: ReplyRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)
    session = await _session_by_id(db, db_user, session_id)
    if session is None:
        return JSONResponse(status_code=404, content={"error": "Interview session not found."})
    if session.status != "active":
        return JSONResponse(status_code=400, content={"error": "This interview has already finished."})

    answer = (body.answer or "").strip()
    if not answer:
        return JSONResponse(status_code=400, content={"error": "Please type an answer."})

    transcript = list(session.transcript or [])
    transcript.append({"role": "student", "content": answer})

    # Cap the interview length.
    if _questions_asked(transcript) >= MAX_QUESTIONS:
        session.transcript = transcript
        session.updated_at = _utc_now()
        await db.commit()
        await db.refresh(session)
        return JSONResponse(content=_serialize(session, can_continue=False))

    try:
        question = next_question(session.country or "", transcript)
    except (AIUnavailableError, AIError) as exc:
        return _ai_error_response(exc)

    transcript.append({"role": "interviewer", "content": question})
    session.transcript = transcript
    session.updated_at = _utc_now()
    try:
        await db.commit()
        await db.refresh(session)
    except Exception:
        await db.rollback()
        logger.exception("Failed to update interview session %s", session_id)
        return JSONResponse(status_code=500, content={"error": "Failed to continue the interview. Please try again."})

    return JSONResponse(content=_serialize(session, can_continue=_questions_asked(transcript) < MAX_QUESTIONS))


# ---------------------------------------------------------------------------
# POST /{id}/finish
# ---------------------------------------------------------------------------

@router.post("/{session_id}/finish")
@limiter.limit("10/minute")
async def finish_interview(
    request: Request,
    session_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)
    session = await _session_by_id(db, db_user, session_id)
    if session is None:
        return JSONResponse(status_code=404, content={"error": "Interview session not found."})

    # Idempotent: a finished session just returns its stored assessment.
    if session.status == "completed" and session.assessment:
        return JSONResponse(content=_serialize(session))

    try:
        assessment = assess(session.country or "", session.transcript or [])
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except (AIUnavailableError, AIError) as exc:
        return _ai_error_response(exc)

    session.assessment = assessment
    session.status = "completed"
    session.updated_at = _utc_now()
    try:
        await db.commit()
        await db.refresh(session)
    except Exception:
        await db.rollback()
        logger.exception("Failed to finish interview session %s", session_id)
        return JSONResponse(status_code=500, content={"error": "Failed to finish the interview. Please try again."})

    return JSONResponse(content=_serialize(session))
