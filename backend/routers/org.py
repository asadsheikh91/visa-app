"""
org.py — Module 5: consultant / agency workspace (B2B).

Staff side (consultant):
  POST   /api/org                      → create a workspace (caller becomes owner)
  GET    /api/org/me                   → caller's org + role, or {org: null}
  POST   /api/org/clients             → invite a student by email (seat-limited)
  GET    /api/org/clients             → roster: each active client's journey summary
  DELETE /api/org/clients/{id}        → remove a client from the roster
  GET    /api/org/clients/{id}/journey → one client's full journey (active only)

Client side (student):
  GET    /api/org/invitations              → invitations addressed to the caller
  POST   /api/org/invitations/{id}/accept  → consent to be managed
  POST   /api/org/invitations/{id}/decline → decline

Consent is enforced: a consultant can only read a client's data once that client
has accepted (status "active").
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.base import AuthUser
from database import get_db
from limiter import limiter
from models import User, Organization, OrgMembership, ManagedClient
from services.user_service import get_user_by_auth_id, get_or_create_user
from services.journey_state import gather_journey_state
from services.journey_service import build_journey
from services.org_rules import (
    normalize_email, can_manage_clients, is_seat_available, can_view_client,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _resolve_db_user(db: AsyncSession, current_user: AuthUser) -> User:
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        db_user = await get_or_create_user(db, current_user.user_id, current_user.email)
    return db_user


async def _membership_for(db: AsyncSession, user: User) -> OrgMembership | None:
    res = await db.execute(
        select(OrgMembership).where(OrgMembership.user_id == user.id).limit(1)
    )
    return res.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Create / read workspace
# ---------------------------------------------------------------------------

class CreateOrgRequest(BaseModel):
    name: str


@router.post("")
@limiter.limit("10/minute")
async def create_org(
    request: Request, body: CreateOrgRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = (body.name or "").strip()
    if not name:
        return JSONResponse(status_code=400, content={"error": "Workspace name is required."})

    db_user = await _resolve_db_user(db, current_user)

    existing = await _membership_for(db, db_user)
    if existing is not None:
        return JSONResponse(status_code=409, content={"error": "You already belong to a workspace."})

    now = _utc_now()
    org = Organization(name=name, plan="team", owner_user_id=db_user.id, created_at=now)
    db.add(org)
    await db.flush()
    membership = OrgMembership(org_id=org.id, user_id=db_user.id, role="owner", created_at=now)
    db.add(membership)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("Failed to create org for %s", current_user.user_id)
        return JSONResponse(status_code=500, content={"error": "Could not create workspace."})

    return JSONResponse(content={"org": {"id": str(org.id), "name": org.name, "plan": org.plan}, "role": "owner"})


@router.get("/me")
@limiter.limit("60/minute")
async def get_my_org(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        return JSONResponse(content={"org": None})
    membership = await _membership_for(db, db_user)
    if membership is None:
        return JSONResponse(content={"org": None})
    res = await db.execute(select(Organization).where(Organization.id == membership.org_id))
    org = res.scalar_one_or_none()
    if org is None:
        return JSONResponse(content={"org": None})
    return JSONResponse(content={
        "org": {"id": str(org.id), "name": org.name, "plan": org.plan},
        "role": membership.role,
    })


# ---------------------------------------------------------------------------
# Roster (consultant side)
# ---------------------------------------------------------------------------

class InviteClientRequest(BaseModel):
    email: str


async def _require_managing_membership(db: AsyncSession, user: User):
    membership = await _membership_for(db, user)
    if membership is None or not can_manage_clients(membership.role):
        return None
    return membership


@router.post("/clients")
@limiter.limit("30/minute")
async def invite_client(
    request: Request, body: InviteClientRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)
    membership = await _require_managing_membership(db, db_user)
    if membership is None:
        return JSONResponse(status_code=403, content={"error": "You don't have a workspace to manage clients."})

    email = normalize_email(body.email)
    if not email or "@" not in email:
        return JSONResponse(status_code=400, content={"error": "A valid client email is required."})

    # Seat check: count non-terminal clients (invited/active).
    res = await db.execute(
        select(func.count()).select_from(ManagedClient).where(
            ManagedClient.org_id == membership.org_id,
            ManagedClient.status.in_(("invited", "active")),
        )
    )
    active_count = int(res.scalar_one() or 0)

    org_res = await db.execute(select(Organization).where(Organization.id == membership.org_id))
    org = org_res.scalar_one()
    if not is_seat_available(active_count, org.plan):
        return JSONResponse(status_code=402, content={"error": "Client seat limit reached for your plan."})

    # Idempotent on (org, email): re-inviting a removed/declined client re-invites.
    existing_res = await db.execute(
        select(ManagedClient).where(
            ManagedClient.org_id == membership.org_id,
            ManagedClient.client_email == email,
        )
    )
    existing = existing_res.scalar_one_or_none()

    # Resolve the client user if they already have an account.
    cu_res = await db.execute(select(User).where(func.lower(User.email) == email))
    client_user = cu_res.scalar_one_or_none()

    now = _utc_now()
    if existing is None:
        row = ManagedClient(
            org_id=membership.org_id, client_email=email,
            client_user_id=client_user.id if client_user else None,
            status="invited", invited_by_user_id=db_user.id,
            created_at=now, updated_at=now,
        )
        db.add(row)
    else:
        if existing.status == "active":
            return JSONResponse(status_code=409, content={"error": "This client is already on your roster."})
        existing.status = "invited"
        existing.client_user_id = client_user.id if client_user else existing.client_user_id
        existing.invited_by_user_id = db_user.id
        existing.updated_at = now
        row = existing

    try:
        await db.commit()
        await db.refresh(row)
    except Exception:
        await db.rollback()
        logger.exception("Failed to invite client for org %s", membership.org_id)
        return JSONResponse(status_code=500, content={"error": "Could not send the invitation."})

    return JSONResponse(content={"id": str(row.id), "email": email, "status": row.status})


@router.get("/clients")
@limiter.limit("60/minute")
async def list_clients(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        return JSONResponse(content={"clients": []})
    membership = await _membership_for(db, db_user)
    if membership is None:
        return JSONResponse(content={"clients": []})

    res = await db.execute(
        select(ManagedClient).where(
            ManagedClient.org_id == membership.org_id,
            ManagedClient.status.in_(("invited", "active")),
        ).order_by(ManagedClient.created_at.desc())
    )
    clients = res.scalars().all()

    out = []
    for c in clients:
        summary = None
        if c.status == "active" and c.client_user_id:
            cu_res = await db.execute(select(User).where(User.id == c.client_user_id))
            cu = cu_res.scalar_one_or_none()
            if cu is not None:
                journey = build_journey(await gather_journey_state(db, cu))
                summary = {
                    "overall_pct": journey["overall_pct"],
                    "next_action_label": journey["next_action_label"],
                    "complete": journey["complete"],
                }
        out.append({
            "id": str(c.id),
            "email": c.client_email,
            "status": c.status,
            "journey": summary,
        })
    return JSONResponse(content={"clients": out})


@router.delete("/clients/{client_id}")
@limiter.limit("30/minute")
async def remove_client(
    request: Request, client_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await _resolve_db_user(db, current_user)
    membership = await _require_managing_membership(db, db_user)
    if membership is None:
        return JSONResponse(status_code=403, content={"error": "You don't have a workspace to manage clients."})

    res = await db.execute(
        select(ManagedClient).where(
            ManagedClient.id == client_id, ManagedClient.org_id == membership.org_id
        )
    )
    client = res.scalar_one_or_none()
    if client is None:
        return JSONResponse(status_code=404, content={"error": "Client not found."})
    client.status = "removed"
    client.updated_at = _utc_now()
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        return JSONResponse(status_code=500, content={"error": "Could not remove the client."})
    return JSONResponse(content={"id": client_id, "status": "removed"})


@router.get("/clients/{client_id}/journey")
@limiter.limit("60/minute")
async def client_journey(
    request: Request, client_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        return JSONResponse(status_code=403, content={"error": "Not authorised."})
    membership = await _membership_for(db, db_user)
    if membership is None:
        return JSONResponse(status_code=403, content={"error": "Not authorised."})

    res = await db.execute(
        select(ManagedClient).where(
            ManagedClient.id == client_id, ManagedClient.org_id == membership.org_id
        )
    )
    client = res.scalar_one_or_none()
    if client is None:
        return JSONResponse(status_code=404, content={"error": "Client not found."})
    if not can_view_client(client.status) or not client.client_user_id:
        return JSONResponse(status_code=403, content={"error": "This client hasn't accepted your invitation yet."})

    cu_res = await db.execute(select(User).where(User.id == client.client_user_id))
    cu = cu_res.scalar_one_or_none()
    if cu is None:
        return JSONResponse(status_code=404, content={"error": "Client account not found."})

    journey = build_journey(await gather_journey_state(db, cu))
    return JSONResponse(content={"email": client.client_email, "journey": journey})


# ---------------------------------------------------------------------------
# Invitations (client side)
# ---------------------------------------------------------------------------

async def _invitations_for_user(db: AsyncSession, user: User) -> list[ManagedClient]:
    email = normalize_email(user.email)
    conds = [ManagedClient.client_user_id == user.id]
    if email:
        conds.append(func.lower(ManagedClient.client_email) == email)
    from sqlalchemy import or_
    res = await db.execute(
        select(ManagedClient).where(
            ManagedClient.status == "invited", or_(*conds)
        ).order_by(ManagedClient.created_at.desc())
    )
    return list(res.scalars().all())


@router.get("/invitations")
@limiter.limit("60/minute")
async def list_invitations(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        return JSONResponse(content={"invitations": []})
    invites = await _invitations_for_user(db, db_user)

    out = []
    for inv in invites:
        org_res = await db.execute(select(Organization).where(Organization.id == inv.org_id))
        org = org_res.scalar_one_or_none()
        out.append({
            "id": str(inv.id),
            "org_name": org.name if org else "A consultant",
        })
    return JSONResponse(content={"invitations": out})


def _invite_belongs_to_user(inv: ManagedClient, user: User) -> bool:
    if inv.client_user_id == user.id:
        return True
    return normalize_email(inv.client_email) == normalize_email(user.email) and bool(user.email)


async def _respond_invite(db, current_user, invitation_id, new_status):
    db_user = await _resolve_db_user(db, current_user)
    res = await db.execute(select(ManagedClient).where(ManagedClient.id == invitation_id))
    inv = res.scalar_one_or_none()
    if inv is None or inv.status != "invited" or not _invite_belongs_to_user(inv, db_user):
        return JSONResponse(status_code=404, content={"error": "Invitation not found."})
    inv.status = new_status
    inv.client_user_id = db_user.id           # bind to the accepting/declining account
    inv.updated_at = _utc_now()
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        return JSONResponse(status_code=500, content={"error": "Could not update the invitation."})
    return JSONResponse(content={"id": str(invitation_id), "status": new_status})


@router.post("/invitations/{invitation_id}/accept")
@limiter.limit("30/minute")
async def accept_invitation(
    request: Request, invitation_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _respond_invite(db, current_user, invitation_id, "active")


@router.post("/invitations/{invitation_id}/decline")
@limiter.limit("30/minute")
async def decline_invitation(
    request: Request, invitation_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _respond_invite(db, current_user, invitation_id, "declined")
