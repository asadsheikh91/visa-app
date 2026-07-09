"""
document_guidance.py

Document Guidance Module endpoints (auth-gated).

POST  /api/visa/documents/plan         → ordered document plan for a profile
PATCH /api/visa/documents/state        → set a document's progress status
POST  /api/visa/documents/corrections  → flag a wrong fee / moved office

The plan is the anti-information-asymmetry product: the minimum ordered set of
documents this user needs, prerequisites first, with the legal fast-track on each.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.base import AuthUser
from database import get_db
from limiter import limiter
from services.user_service import get_user_by_auth_id, get_or_create_user
from services.document_guidance_service import (
    get_document_path,
    set_document_status,
    add_correction,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class DocProfileRequest(BaseModel):
    target_country: str = "uk"
    education_level: str = ""
    studied_in_pakistan: bool = True
    marital_status: str = ""
    documents_already_held: list[str] = []
    # Optional explicit override for the IBCC branch.
    needs_intermediate_equivalence: Optional[bool] = None


class DocStateRequest(BaseModel):
    document_id: str
    status: str          # have | in_progress | done


class CorrectionRequest(BaseModel):
    document_id: Optional[str] = None
    office_id: Optional[str] = None
    # Free-text "this is wrong" note, persisted as-is; 2k chars is ample for a
    # correction and caps stored size.
    note: str = Field(..., max_length=2_000)


async def _resolve_db_user(db: AsyncSession, current_user: AuthUser):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        db_user = await get_or_create_user(db, current_user.user_id, current_user.email)
    return db_user


@router.post("/plan")
@limiter.limit("60/minute")
async def document_plan(
    request: Request,
    body: DocProfileRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)
    profile = body.model_dump(exclude_none=True)
    try:
        plan = await get_document_path(db, profile, user_id=db_user.id)
    except Exception:
        logger.exception("Failed to build document plan for %s", current_user.user_id)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to build your document plan. Please try again."},
        )
    return JSONResponse(content=plan)


@router.patch("/state")
@limiter.limit("120/minute")
async def update_state(
    request: Request,
    body: DocStateRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)
    try:
        row = await set_document_status(db, db_user.id, body.document_id, body.status)
    except ValueError as exc:
        await db.rollback()
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except Exception:
        await db.rollback()
        logger.exception("Failed to set document status for %s", current_user.user_id)
        return JSONResponse(status_code=500, content={"error": "Failed to save. Please try again."})

    return JSONResponse(content={"document_id": row.document_id, "status": row.status})


@router.post("/corrections")
@limiter.limit("20/minute")
async def submit_correction(
    request: Request,
    body: CorrectionRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = (body.note or "").strip()
    if not note:
        return JSONResponse(status_code=400, content={"error": "Please describe what's wrong."})

    db_user = await _resolve_db_user(db, current_user)
    try:
        await add_correction(db, db_user.id, body.document_id, body.office_id, note)
    except Exception:
        await db.rollback()
        logger.exception("Failed to record correction for %s", current_user.user_id)
        return JSONResponse(status_code=500, content={"error": "Failed to submit. Please try again."})

    return JSONResponse(content={"ok": True})
