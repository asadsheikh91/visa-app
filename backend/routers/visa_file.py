"""
visa_file.py

Visa File Builder endpoints (Sprint 1).

POST  /api/visa/file/generate          → fetch-or-create the file for a check
PATCH /api/visa/file/{file_id}/item    → update one checklist item's status

The file is always tied to the authenticated user. Generation is idempotent per
readiness check: calling it again returns the same file with the user's status
edits intact.
"""

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
from models import VisaCheck
from services.user_service import get_user_by_auth_id, get_or_create_user
from services.profile_service import get_profile
from services.visa_file_service import (
    fetch_or_create_file,
    get_file_by_id,
    update_item_status,
    apply_financial_proof,
    apply_sponsor_evidence,
    serialize_file,
)
from services.financial_proof_engine import evaluate as evaluate_financial_proof
from services.sponsor_evidence_engine import evaluate as evaluate_sponsor_evidence

logger = logging.getLogger(__name__)
router = APIRouter()


class GenerateRequest(BaseModel):
    # If omitted, the user's latest readiness check is used.
    visa_check_id: Optional[str] = None


class ItemStatusRequest(BaseModel):
    item_id: str
    status: str


class SponsorEvidenceRequest(BaseModel):
    relationship:             str = ""
    sponsor_name:             str = ""
    funds_in_sponsor_account: str = "not_sure"
    bank_statement_status:    str = "not_sure"
    income_proof_available:   str = "no"
    income_type:              str = ""
    large_deposits:           str = "not_sure"
    source_explainable:       str = "not_sure"


class FinancialProofRequest(BaseModel):
    tuition_fee:            float = 0.0
    deposit_paid:           float = 0.0
    available_funds:        float = 0.0
    funding_source:         str   = ""
    funds_in_whose_account: str   = ""
    bank_statement_status:  str   = "not_sure"
    funds_held_duration:    str   = "not_sure"
    large_deposits:         str   = "not_sure"
    source_of_funds:        str   = ""
    income_proof_available: str   = "no"
    scholarship_or_loan:    str   = "no"
    course_location:        str   = ""      # UK only: london | outside
    course_months:          int   = 0       # course length; UK caps maintenance at 9


async def _resolve_db_user(db, current_user: AuthUser):
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


# ---------------------------------------------------------------------------
# POST /generate
# ---------------------------------------------------------------------------

@router.post("/generate")
@limiter.limit("30/minute")
async def generate_file(
    request: Request,
    body: GenerateRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)

    # Pick the target check: explicit id, else the latest.
    if body.visa_check_id:
        check = await _check_by_id(db, db_user, body.visa_check_id)
        if check is None:
            return JSONResponse(status_code=404, content={"error": "Readiness check not found."})
    else:
        check = await _latest_check(db, db_user)
        if check is None:
            return JSONResponse(
                status_code=404,
                content={"error": "No readiness check yet. Run the checker first."},
            )

    profile = await get_profile(db, db_user)

    try:
        file = await fetch_or_create_file(db, db_user, check, profile)
    except Exception:
        await db.rollback()
        logger.exception(
            "Failed to generate visa file for auth_user_id=%s check=%s",
            current_user.user_id, check.id,
        )
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to build your visa file. Please try again."},
        )

    return JSONResponse(content=serialize_file(file))


# ---------------------------------------------------------------------------
# PATCH /{file_id}/item
# ---------------------------------------------------------------------------

@router.patch("/{file_id}/item")
@limiter.limit("120/minute")
async def patch_item(
    request: Request,
    file_id: str,
    body: ItemStatusRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)

    file = await get_file_by_id(db, db_user, file_id)
    if file is None:
        return JSONResponse(status_code=404, content={"error": "Visa file not found."})

    try:
        file = await update_item_status(db, file, body.item_id, body.status)
    except ValueError as exc:
        await db.rollback()
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except Exception:
        await db.rollback()
        logger.exception("Failed to update item on visa file %s", file_id)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to update the checklist item. Please try again."},
        )

    return JSONResponse(content=serialize_file(file))


# ---------------------------------------------------------------------------
# POST /{file_id}/financial-proof
# ---------------------------------------------------------------------------

@router.post("/{file_id}/financial-proof")
@limiter.limit("30/minute")
async def assess_financial_proof(
    request: Request,
    file_id: str,
    body: FinancialProofRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)

    file = await get_file_by_id(db, db_user, file_id)
    if file is None:
        return JSONResponse(status_code=404, content={"error": "Visa file not found."})

    fp_inputs = body.model_dump()
    fp_result = evaluate_financial_proof(fp_inputs, file.country)

    try:
        file = await apply_financial_proof(db, file, fp_inputs, fp_result)
    except Exception:
        await db.rollback()
        logger.exception("Failed to apply financial proof to file %s", file_id)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to update your visa file. Please try again."},
        )

    # Strip the internal checklist_injections list before returning to the client.
    assessment = {k: v for k, v in fp_result.items() if k != "checklist_injections"}
    return JSONResponse(content={"assessment": assessment, "file": serialize_file(file)})


# ---------------------------------------------------------------------------
# POST /{file_id}/sponsor-evidence
# ---------------------------------------------------------------------------

@router.post("/{file_id}/sponsor-evidence")
@limiter.limit("30/minute")
async def assess_sponsor_evidence(
    request: Request,
    file_id: str,
    body: SponsorEvidenceRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)

    file = await get_file_by_id(db, db_user, file_id)
    if file is None:
        return JSONResponse(status_code=404, content={"error": "Visa file not found."})

    sp_inputs = body.model_dump()
    sp_result = evaluate_sponsor_evidence(sp_inputs)

    try:
        file = await apply_sponsor_evidence(db, file, sp_inputs, sp_result)
    except Exception:
        await db.rollback()
        logger.exception("Failed to apply sponsor evidence to file %s", file_id)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to update your visa file. Please try again."},
        )

    return JSONResponse(content={
        "warnings": sp_result.get("warnings", []),
        "file":     serialize_file(file),
    })
