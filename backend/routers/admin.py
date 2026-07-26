"""
routers/admin.py

Operator admin panel API. EVERY route is gated by get_admin_user (ADMIN_EMAILS
allowlist → 403 otherwise); the frontend gate is convenience only.

  GET   /api/admin/me                              → { admin: true }
  GET   /api/admin/overview                        → KPI + funnel aggregates
  GET   /api/admin/users?search=&plan=&limit=&offset=
  GET   /api/admin/users/{user_id}                 → full drill-down (PII masked)
  GET   /api/admin/users/{user_id}/checks/{check_id}
  GET   /api/admin/users/{user_id}/reports/{report_id}   → decrypted ReportData
  PATCH /api/admin/users/{user_id}                 → set plan / cap overrides
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_admin_user
from database import get_db
from limiter import limiter
from models import Report, User
from services import admin_service
from services.report_builder import decrypt_report_data

logger = logging.getLogger(__name__)
router = APIRouter()


class UserUpdate(BaseModel):
    plan: Optional[str] = None
    # Per-user lifetime cap overrides. Send null to clear (revert to default); a
    # non-negative int to set. 0 blocks the feature for this user entirely.
    readiness_check_limit: Optional[int] = Field(default=None, ge=0)
    report_limit: Optional[int] = Field(default=None, ge=0)
    # Distinguishes "field omitted" from "explicitly set to null" for the caps.
    clear_check_limit: bool = False
    clear_report_limit: bool = False


@router.get("/me")
@limiter.limit("60/minute")
async def admin_me(request: Request, admin: User = Depends(get_admin_user)):
    return JSONResponse(content={"admin": True, "email": admin.email if admin else None})


@router.get("/overview")
@limiter.limit("60/minute")
async def overview(
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    return JSONResponse(content=await admin_service.get_overview(db))


@router.get("/users")
@limiter.limit("60/minute")
async def list_users(
    request: Request,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    search: Optional[str] = Query(None),
    plan: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return JSONResponse(content=await admin_service.list_users(db, search, plan, limit, offset))


@router.get("/users/{user_id}")
@limiter.limit("60/minute")
async def user_detail(
    request: Request,
    user_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    user = await admin_service.get_user_by_id(db, user_id)
    if user is None:
        return JSONResponse(status_code=404, content={"error": "User not found."})
    return JSONResponse(content=await admin_service.get_user_detail(db, user))


@router.get("/users/{user_id}/checks/{check_id}")
@limiter.limit("60/minute")
async def user_check(
    request: Request,
    user_id: str,
    check_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    user = await admin_service.get_user_by_id(db, user_id)
    if user is None:
        return JSONResponse(status_code=404, content={"error": "User not found."})
    detail = await admin_service.get_user_check(db, user, check_id)
    if detail is None:
        return JSONResponse(status_code=404, content={"error": "Check not found."})
    return JSONResponse(content=detail)


@router.get("/users/{user_id}/reports/{report_id}")
@limiter.limit("30/minute")
async def user_report(
    request: Request,
    user_id: str,
    report_id: str,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    user = await admin_service.get_user_by_id(db, user_id)
    if user is None:
        return JSONResponse(status_code=404, content={"error": "User not found."})
    try:
        res = await db.execute(select(Report).where(Report.id == report_id))
        report = res.scalar_one_or_none()
    except Exception:
        return JSONResponse(status_code=404, content={"error": "Report not found."})
    if report is None or report.user_id != user.id:
        return JSONResponse(status_code=404, content={"error": "Report not found."})
    try:
        data = decrypt_report_data(report)
    except Exception:
        logger.exception("Admin: failed to decrypt report %s", report.report_id)
        return JSONResponse(status_code=500, content={"error": "Failed to load report."})
    return JSONResponse(content=data)


@router.patch("/users/{user_id}")
@limiter.limit("30/minute")
async def update_user(
    request: Request,
    user_id: str,
    body: UserUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    user = await admin_service.get_user_by_id(db, user_id)
    if user is None:
        return JSONResponse(status_code=404, content={"error": "User not found."})

    if body.plan is not None:
        user.plan = body.plan.strip() or "free"
    if body.clear_check_limit:
        user.readiness_check_limit = None
    elif body.readiness_check_limit is not None:
        user.readiness_check_limit = body.readiness_check_limit
    if body.clear_report_limit:
        user.report_limit = None
    elif body.report_limit is not None:
        user.report_limit = body.report_limit

    try:
        await db.commit()
        await db.refresh(user)
    except Exception:
        await db.rollback()
        logger.exception("Admin: failed to update user %s", user_id)
        return JSONResponse(status_code=500, content={"error": "Failed to update user."})

    return JSONResponse(content={
        "id":                    str(user.id),
        "plan":                  user.plan,
        "readiness_check_limit": user.readiness_check_limit,
        "report_limit":          user.report_limit,
    })
