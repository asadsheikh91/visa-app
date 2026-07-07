"""
trust.py — Module 2: Trust / Freshness endpoints.

GET  /api/visa/trust/freshness              → freshness of every destination's guidance
GET  /api/visa/trust/{country}/freshness    → freshness for one destination
GET  /api/visa/trust/changelog              → all rule changes (optionally ?country=)
GET  /api/visa/trust/{country}/updates      → changes new to this user (since last seen)
POST /api/visa/trust/{country}/ack          → mark the user caught up for a country
GET  /api/visa/trust/preferences            → user's alert opt-in
POST /api/visa/trust/preferences            → set alert opt-in

Freshness/changelog are user-agnostic; updates/ack/preferences use per-user state.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.base import AuthUser
from database import get_db
from limiter import limiter
from models import UserTrustState
from services.user_service import get_user_by_auth_id, get_or_create_user
from services.country_sources import COUNTRY_AUTHORITY
from services.freshness import (
    all_freshness, country_freshness, sorted_changelog, updates_since,
    _latest_change_date,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _resolve_db_user(db: AsyncSession, current_user: AuthUser):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        db_user = await get_or_create_user(db, current_user.user_id, current_user.email)
    return db_user


async def _get_trust_state(db: AsyncSession, user) -> UserTrustState | None:
    result = await db.execute(
        select(UserTrustState).where(UserTrustState.user_id == user.id)
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Freshness
# ---------------------------------------------------------------------------

@router.get("/freshness")
@limiter.limit("60/minute")
async def get_all_freshness(request: Request, current_user: AuthUser = Depends(get_current_user)):
    return JSONResponse(content=all_freshness())


@router.get("/{country}/freshness")
@limiter.limit("60/minute")
async def get_country_freshness(
    request: Request, country: str, current_user: AuthUser = Depends(get_current_user),
):
    fs = country_freshness(country)
    if fs is None:
        return JSONResponse(status_code=404, content={"error": "This country is not supported yet."})
    return JSONResponse(content=fs)


# ---------------------------------------------------------------------------
# Changelog
# ---------------------------------------------------------------------------

@router.get("/changelog")
@limiter.limit("60/minute")
async def get_changelog_all(
    request: Request, country: str | None = None,
    current_user: AuthUser = Depends(get_current_user),
):
    if country:
        entries = sorted_changelog(country)
        if entries is None:
            return JSONResponse(status_code=404, content={"error": "This country is not supported yet."})
        return JSONResponse(content=entries)
    # All countries, each entry tagged with its country, newest first.
    merged: list[dict] = []
    for c in COUNTRY_AUTHORITY:
        for e in sorted_changelog(c) or []:
            merged.append({"country": c, **e})
    merged.sort(key=lambda e: e.get("date", ""), reverse=True)
    return JSONResponse(content=merged)


# ---------------------------------------------------------------------------
# Per-user updates ("what changed since you last checked")
# ---------------------------------------------------------------------------

@router.get("/{country}/updates")
@limiter.limit("60/minute")
async def get_updates(
    request: Request, country: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if country.lower().strip() not in COUNTRY_AUTHORITY:
        return JSONResponse(status_code=404, content={"error": "This country is not supported yet."})

    db_user = await _resolve_db_user(db, current_user)
    state = await _get_trust_state(db, db_user)
    since = (state.last_seen_change or {}).get(country.lower().strip()) if state else None

    new_entries = updates_since(country, since)
    return JSONResponse(content={
        "country": country.lower().strip(),
        "since": since,
        "new_count": len(new_entries),
        "updates": new_entries,
    })


class AckRequest(BaseModel):
    # Optional explicit date to ack up to; defaults to the latest changelog date.
    up_to: str | None = None


@router.post("/{country}/ack")
@limiter.limit("30/minute")
async def ack_updates(
    request: Request, country: str, body: AckRequest = AckRequest(),
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    country = country.lower().strip()
    if country not in COUNTRY_AUTHORITY:
        return JSONResponse(status_code=404, content={"error": "This country is not supported yet."})

    db_user = await _resolve_db_user(db, current_user)
    ack_to = body.up_to or _latest_change_date(sorted_changelog(country) or []) or ""

    state = await _get_trust_state(db, db_user)
    now = _utc_now()
    if state is None:
        state = UserTrustState(
            user_id=db_user.id,
            last_seen_change={country: ack_to} if ack_to else {},
            created_at=now, updated_at=now,
        )
        db.add(state)
    else:
        seen = dict(state.last_seen_change or {})
        if ack_to:
            seen[country] = ack_to
        state.last_seen_change = seen
        state.updated_at = now

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("Failed to persist trust ack for %s", current_user.user_id)
        return JSONResponse(status_code=500, content={"error": "Could not save. Please try again."})

    return JSONResponse(content={"country": country, "acked_to": ack_to})


# ---------------------------------------------------------------------------
# Alert preferences
# ---------------------------------------------------------------------------

class PreferencesRequest(BaseModel):
    alerts_opt_in: bool


@router.get("/preferences")
@limiter.limit("60/minute")
async def get_preferences(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)
    state = await _get_trust_state(db, db_user)
    return JSONResponse(content={"alerts_opt_in": bool(state.alerts_opt_in) if state else False})


@router.post("/preferences")
@limiter.limit("30/minute")
async def set_preferences(
    request: Request, body: PreferencesRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)
    state = await _get_trust_state(db, db_user)
    now = _utc_now()
    if state is None:
        state = UserTrustState(
            user_id=db_user.id, last_seen_change={},
            alerts_opt_in=body.alerts_opt_in, created_at=now, updated_at=now,
        )
        db.add(state)
    else:
        state.alerts_opt_in = body.alerts_opt_in
        state.updated_at = now
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("Failed to persist trust preferences for %s", current_user.user_id)
        return JSONResponse(status_code=500, content={"error": "Could not save. Please try again."})
    return JSONResponse(content={"alerts_opt_in": body.alerts_opt_in})
