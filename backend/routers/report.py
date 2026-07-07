"""
routers/report.py

Readiness Report endpoints.

  POST /api/visa/assessments/{assessment_id}/report
        Build (or return the cached) report for one of the caller's checks.
        → { token, reportId, narratedByAi }

  GET  /api/visa/reports/{token}
        Return the ReportData JSON for on-screen render.

Access control (constraint #7):
  - Paid plan required (services.entitlements.has_report_access) → 403 if unpaid.
  - Ownership enforced on every route.
  - Assessment routes 403 on non-owner (ids are unguessable UUIDs).
  - Report token routes 404 on bad/foreign token — never a 403 that would confirm
    a token exists (no enumeration oracle).

The PDF route (server-side Playwright render) is added in a later phase.
"""

import asyncio
import logging
import os
from datetime import timedelta

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.base import AuthUser
from auth.dependencies import get_current_user
from database import get_db
from limiter import limiter
from models import Report, UserVisaProfile, VisaCheck, utc_now_naive
from services import entitlements, render_tokens, report_pdf, report_storage
from services.report_builder import ReportError, build_report, decrypt_report_data
from services.user_service import get_user_by_auth_id
from services.visa_data_service import (
    DataCorruptedError,
    DataNotFoundError,
    StorageConfigError,
    StorageUnavailableError,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Base URL Playwright uses to load the print route. Defaults to the local Next dev
# server; set REPORT_PRINT_BASE_URL to the deployed frontend origin in production.
_PRINT_BASE_URL = os.getenv("REPORT_PRINT_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
_PDF_URL_TTL = 300  # seconds the signed R2 URL stays valid


def _visa_data_error(exc: Exception) -> JSONResponse | None:
    if isinstance(exc, DataNotFoundError):
        return JSONResponse(status_code=404, content={"error": str(exc)})
    if isinstance(exc, DataCorruptedError):
        return JSONResponse(status_code=500, content={"error": "Visa data is misconfigured."})
    if isinstance(exc, (StorageConfigError, StorageUnavailableError)):
        return JSONResponse(status_code=503, content={"error": "Visa data is temporarily unavailable."})
    return None


# ---------------------------------------------------------------------------
# POST /assessments/{assessment_id}/report
# ---------------------------------------------------------------------------

@router.post("/assessments/{assessment_id}/report")
@limiter.limit("10/minute")
async def create_report(
    request: Request,
    assessment_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        return JSONResponse(status_code=404, content={"error": "Assessment not found."})

    # TEMP FREE-ACCESS WINDOW (opened 2026-07-08, remove on/after 2026-07-15):
    # Reports are free for all signed-in users for one week ahead of the payment
    # launch. Re-enable by uncommenting the block below — no other change needed.
    # if not entitlements.has_report_access(db_user):
    #     return JSONResponse(
    #         status_code=403,
    #         content={"error": "A paid plan is required to generate a Readiness Report."},
    #     )

    # Look up the assessment; UUID parse failure or missing row → 404.
    try:
        result = await db.execute(select(VisaCheck).where(VisaCheck.id == assessment_id))
        check = result.scalar_one_or_none()
    except Exception:
        return JSONResponse(status_code=404, content={"error": "Assessment not found."})

    if check is None:
        return JSONResponse(status_code=404, content={"error": "Assessment not found."})
    if check.user_id != db_user.id:
        # Owner mismatch on an unguessable UUID → 403 per spec.
        return JSONResponse(status_code=403, content={"error": "You do not own this assessment."})

    prof_res = await db.execute(
        select(UserVisaProfile).where(UserVisaProfile.user_id == db_user.id)
    )
    profile = prof_res.scalar_one_or_none()

    try:
        report = await build_report(db, db_user, check, profile)
    except ReportError as exc:
        logger.warning("Report build unavailable: %s", exc)
        return JSONResponse(status_code=503, content={"error": str(exc)})
    except Exception as exc:  # noqa: BLE001
        mapped = _visa_data_error(exc)
        if mapped is not None:
            return mapped
        logger.exception("Report build failed for assessment %s", assessment_id)
        return JSONResponse(status_code=500, content={"error": "Failed to generate report."})

    return JSONResponse(content={
        "token": report.token,
        "reportId": report.report_id,
        "narratedByAi": report.narrated_by_ai,
    })


# ---------------------------------------------------------------------------
# GET /reports/{token}
# ---------------------------------------------------------------------------

@router.get("/reports/{token}")
@limiter.limit("60/minute")
async def get_report(
    request: Request,
    token: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        return JSONResponse(status_code=404, content={"error": "Report not found."})

    result = await db.execute(select(Report).where(Report.token == token))
    report = result.scalar_one_or_none()

    # Bad token OR foreign report → 404 (never reveal existence). No 403 oracle.
    if report is None or report.user_id != db_user.id:
        return JSONResponse(status_code=404, content={"error": "Report not found."})

    # Owner but plan lapsed → 403 (download is a paid feature).
    # TEMP FREE-ACCESS WINDOW (opened 2026-07-08, remove on/after 2026-07-15):
    # viewing a report is free for its owner during the one-week launch window.
    # Re-enable by uncommenting the block below.
    # if not entitlements.has_report_access(db_user):
    #     return JSONResponse(
    #         status_code=403,
    #         content={"error": "A paid plan is required to view this report."},
    #     )

    try:
        data = decrypt_report_data(report)
    except Exception:
        logger.exception("Failed to decrypt report %s", report.report_id)
        return JSONResponse(status_code=500, content={"error": "Failed to load report."})

    return JSONResponse(content=data)


# ---------------------------------------------------------------------------
# GET /reports/{token}/pdf  — server-side Playwright render → signed R2 URL
# ---------------------------------------------------------------------------

@router.get("/reports/{token}/pdf")
@limiter.limit("6/minute")
async def get_report_pdf(
    request: Request,
    token: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        return JSONResponse(status_code=404, content={"error": "Report not found."})

    result = await db.execute(select(Report).where(Report.token == token))
    report = result.scalar_one_or_none()
    if report is None or report.user_id != db_user.id:
        return JSONResponse(status_code=404, content={"error": "Report not found."})
    # TEMP FREE-ACCESS WINDOW (opened 2026-07-08, remove on/after 2026-07-15):
    # PDF download is free for the report's owner during the one-week launch
    # window. Re-enable by uncommenting the two lines below.
    # if not entitlements.has_report_access(db_user):
    #     return JSONResponse(status_code=403, content={"error": "A paid plan is required to download this report."})

    if not report_storage.is_configured():
        return JSONResponse(status_code=503, content={"error": "PDF export is not configured."})

    # Mint a single-use render token (owner + plan already verified) so headless
    # Playwright can load the print route without a Clerk session.
    rt = render_tokens.mint(token)
    print_url = f"{_PRINT_BASE_URL}/report/{token}/print?rt={rt}"

    try:
        pdf_bytes = await asyncio.to_thread(report_pdf.render_report_pdf, print_url)
        key = report_storage.object_key(token, report.report_id)
        await asyncio.to_thread(report_storage.upload_pdf, key, pdf_bytes)
        signed_url = await asyncio.to_thread(report_storage.presigned_get_url, key, _PDF_URL_TTL)
    except report_pdf.PdfRenderError:
        return JSONResponse(status_code=503, content={"error": "Could not render the report PDF. Please try again."})
    except report_storage.ReportStorageError:
        return JSONResponse(status_code=503, content={"error": "Report storage is temporarily unavailable."})

    expires_at = (utc_now_naive() + timedelta(seconds=_PDF_URL_TTL)).isoformat() + "Z"
    return JSONResponse(content={"url": signed_url, "expiresAt": expires_at})


# ---------------------------------------------------------------------------
# GET /reports/{token}/render  — Clerk-free, render-token-gated data for Playwright
# ---------------------------------------------------------------------------

@router.get("/reports/{token}/render")
@limiter.limit("30/minute")
async def render_report_data(
    request: Request,
    token: str,
    rt: str = Query(..., description="Single-use render token from the /pdf route."),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns ReportData for the print route WITHOUT Clerk auth — the single-use
    render token IS the capability. It is minted only after ownership + plan were
    verified on /pdf, is bound to exactly this report token, and is consumed here
    (so it cannot be replayed). A bad/expired/mismatched token → 404 (no oracle).
    """
    mapped = render_tokens.consume(rt)
    if mapped != token:
        return JSONResponse(status_code=404, content={"error": "Report not found."})

    result = await db.execute(select(Report).where(Report.token == token))
    report = result.scalar_one_or_none()
    if report is None:
        return JSONResponse(status_code=404, content={"error": "Report not found."})

    try:
        data = decrypt_report_data(report)
    except Exception:
        logger.exception("Failed to decrypt report %s for render", report.report_id)
        return JSONResponse(status_code=500, content={"error": "Failed to load report."})

    return JSONResponse(content=data)
