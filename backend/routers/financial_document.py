"""
financial_document.py

Bank Statement Checker (manual entry). The user enters the figures from their
bank statement; the deterministic rule engine checks them against the official UK
financial rules (28-day minimum balance, threshold, recency, holder match, large
deposits, currency). No file reading / OCR — just the calculator.

POST /api/visa/documents/financial/evaluate  → run the rules on entered values
GET  /api/visa/documents/financial/history    → the user's recent checks

Quota-limited via entitlements (free plan). Rows double as the usage log.
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
from models import UserDocument
from services.user_service import get_user_by_auth_id, get_or_create_user
from services.entitlements import check_quota
from services.encryption import encrypt_json, is_envelope, EncryptionUnavailableError
from services.financial_document_engine import evaluate as evaluate_financial_document

logger = logging.getLogger(__name__)
router = APIRouter()

SUPPORTED_COUNTRIES = {"uk"}   # corridor MVP: UK Student route


async def _resolve_db_user(db: AsyncSession, current_user: AuthUser):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        db_user = await get_or_create_user(db, current_user.user_id, current_user.email)
    return db_user


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class BalanceEntryIn(BaseModel):
    date: Optional[str] = None       # ISO "YYYY-MM-DD"
    balance: Optional[float] = None


class StatementIn(BaseModel):
    bank_name: Optional[str] = None
    account_holder: Optional[str] = None
    currency: Optional[str] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
    # The balance-over-time the user enters from their statement. The engine reads
    # `balance` per dated row to compute the 28-day minimum.
    transactions: list[BalanceEntryIn] = []


class ContextIn(BaseModel):
    applicant_name: Optional[str] = None
    application_date: Optional[str] = None
    required_amount: Optional[float] = None
    tuition_fee: Optional[float] = None
    deposit_paid: Optional[float] = None
    course_location: Optional[str] = None
    course_months: Optional[int] = None
    sponsor_names: list[str] = []
    fx_rate_to_gbp: Optional[float] = None


class EvaluateRequest(BaseModel):
    statement: StatementIn
    context: ContextIn = ContextIn()
    country: Optional[str] = None


# ---------------------------------------------------------------------------
# Evaluate
# ---------------------------------------------------------------------------

@router.post("/evaluate")
@limiter.limit("30/minute")
async def evaluate_statement(
    request: Request,
    body: EvaluateRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)

    allowed, remaining = await check_quota(db, db_user, "financial_document", UserDocument)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"error": "You've reached today's free checks. Please try again tomorrow."},
        )

    country = (body.country or "uk").lower().strip()
    if country not in SUPPORTED_COUNTRIES:
        return JSONResponse(
            status_code=400,
            content={"error": f"Checking is currently available for: {', '.join(sorted(SUPPORTED_COUNTRIES))}."},
        )

    statement = body.statement.model_dump()
    context = {k: v for k, v in body.context.model_dump().items() if v not in (None, [], "")}

    try:
        result = evaluate_financial_document(statement, context, country)
    except Exception:
        logger.exception("Financial document evaluation failed for %s", current_user.user_id)
        return JSONResponse(
            status_code=500,
            content={"error": "We couldn't evaluate these values. Please re-check what you entered."},
        )

    # Persist for history (derived values only; no document is ever uploaded).
    # `extracted` contains the applicant's raw bank figures (balances, account
    # holder, bank name) — PII — so it is encrypted at the application layer
    # before it touches the database (see services/encryption.py). We fail closed
    # (503) rather than fall back to storing plaintext if no key is configured.
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    bank_slug = (statement.get("bank_name") or "").lower().replace(" ", "_") or None
    try:
        encrypted_statement = encrypt_json(statement)
    except EncryptionUnavailableError:
        # Never log the key; this only reports that the env var is unset/invalid.
        logger.error(
            "FIELD_ENCRYPTION_KEY missing/invalid; refusing to store statement as plaintext."
        )
        return JSONResponse(
            status_code=503,
            content={"error": "Secure storage is not configured. Please try again later."},
        )
    # Defence in depth: the only value that may ever reach UserDocument.extracted
    # is a Fernet envelope. If encrypt_json ever returns something else (e.g. a
    # future refactor accidentally re-introduces a plaintext path), fail closed
    # (503) instead of writing applicant PII in the clear. There is no code path
    # under which the raw `statement` dict is persisted.
    if not is_envelope(encrypted_statement):
        logger.error("Refusing to persist non-encrypted statement payload (not a Fernet envelope).")
        return JSONResponse(
            status_code=503,
            content={"error": "Secure storage is not configured. Please try again later."},
        )
    doc = UserDocument(
        user_id=db_user.id,
        doc_type="financial_statement",
        country=country,
        bank_id=bank_slug,
        status="evaluated",
        content_hash=None,
        extracted=encrypted_statement,
        result=result,
        created_at=now,
        updated_at=now,
    )
    db.add(doc)
    try:
        await db.commit()
        await db.refresh(doc)
        doc_id = str(doc.id)
    except Exception:
        await db.rollback()
        logger.exception("Failed to persist evaluation for %s", current_user.user_id)
        doc_id = None

    return JSONResponse(content={
        "id": doc_id,
        "country": country,
        "result": result,
        "remaining": max(0, remaining - 1),
    })


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

@router.get("/history")
@limiter.limit("30/minute")
async def document_history(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        return JSONResponse(content=[])

    result = await db.execute(
        select(UserDocument)
        .where(UserDocument.user_id == db_user.id,
               UserDocument.doc_type == "financial_statement")
        .order_by(UserDocument.created_at.desc())
        .limit(10)
    )
    docs = result.scalars().all()
    return JSONResponse(content=[
        {
            "id":             str(d.id),
            "country":        d.country,
            "bank_id":        d.bank_id,
            "status":         d.status,
            "overall_status": (d.result or {}).get("overall_status"),
            "created_at":     d.created_at.isoformat(),
        }
        for d in docs
    ])
