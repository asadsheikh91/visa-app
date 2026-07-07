"""
document_guidance_service.py

DB layer for the Document Guidance Module. Loads the document DAG + offices, calls
the pure engine (document_guidance_engine.build_plan), and persists user progress
and corrections.

`get_document_path(db, profile, user_id=None)` is the **standalone interface** the
readiness/scoring engine will call later — it is intentionally not coupled to that
engine now.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    DocumentRef, DocumentEdge, Office, UserDocumentState, Correction,
    USER_DOCUMENT_STATUS_VALUES,
)
from services.document_guidance_engine import build_plan

logger = logging.getLogger(__name__)

# Statuses a user is allowed to set directly (engine derives blocked/ready).
SETTABLE_STATUSES = {"have", "in_progress", "done"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _map_link(lat, lng) -> str | None:
    if lat is None or lng is None:
        return None
    return f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"


def _office_dict(office: Office | None) -> dict | None:
    if office is None:
        return None
    return {
        "id":                     office.id,
        "name":                   office.authority,
        "authority":              office.authority,
        "city":                   office.city,
        "address":                office.address,
        "hours":                  office.hours,
        "online_appointment_url": office.online_appointment_url,
        "map_link":               _map_link(office.lat, office.lng),
        "last_verified_at":       office.last_verified_at.date().isoformat() if office.last_verified_at else None,
    }


def _doc_dict(doc: DocumentRef, offices_by_id: dict[str, Office]) -> dict:
    return {
        "id":                doc.id,
        "name":              doc.name,
        "country_relevance": doc.country_relevance or [],
        "issuing_authority": doc.issuing_authority,
        "official_url":      doc.official_url,
        "normal_cost":       doc.normal_cost,
        "urgent_cost":       doc.urgent_cost,
        "normal_days":       doc.normal_days,
        "urgent_days":       doc.urgent_days,
        "validity_months":   doc.validity_months,
        "office":            _office_dict(offices_by_id.get(doc.office_id)) if doc.office_id else None,
        "display_order":     doc.display_order or 0,
        "last_verified_at":  doc.last_verified_at.date().isoformat() if doc.last_verified_at else None,
        "source_url":        doc.source_url,
    }


async def _load_state(db: AsyncSession, user_id) -> dict[str, str]:
    if user_id is None:
        return {}
    result = await db.execute(
        select(UserDocumentState).where(UserDocumentState.user_id == user_id)
    )
    return {row.document_id: row.status for row in result.scalars().all()}


async def get_document_path(db: AsyncSession, profile: dict, user_id=None) -> dict:
    """
    Build the ordered document plan for `profile`. When `user_id` is given, the
    user's saved progress is folded in (have/in_progress/done). This is the public
    entry point the scoring engine will reuse.
    """
    docs_res = await db.execute(select(DocumentRef))
    documents = docs_res.scalars().all()

    edges_res = await db.execute(select(DocumentEdge))
    edges = [
        {"document_id": e.document_id, "requires_id": e.requires_id, "condition": e.condition}
        for e in edges_res.scalars().all()
    ]

    offices_res = await db.execute(select(Office))
    offices_by_id = {o.id: o for o in offices_res.scalars().all()}

    doc_dicts = [_doc_dict(d, offices_by_id) for d in documents]
    state = await _load_state(db, user_id)

    return build_plan(doc_dicts, edges, profile, state)


async def set_document_status(db: AsyncSession, user_id, document_id: str, status: str) -> UserDocumentState:
    """Upsert the user's progress on one document. Raises ValueError on bad input."""
    if status not in SETTABLE_STATUSES:
        raise ValueError(
            f"Invalid status '{status}'. Allowed: {', '.join(sorted(SETTABLE_STATUSES))}."
        )

    # Validate the document exists (string-slug FK).
    exists = await db.execute(select(DocumentRef.id).where(DocumentRef.id == document_id))
    if exists.scalar_one_or_none() is None:
        raise ValueError(f"Unknown document '{document_id}'.")

    result = await db.execute(
        select(UserDocumentState).where(
            UserDocumentState.user_id == user_id,
            UserDocumentState.document_id == document_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = UserDocumentState(
            user_id=user_id, document_id=document_id, status=status, updated_at=_utc_now()
        )
        db.add(row)
    else:
        row.status = status
        row.updated_at = _utc_now()

    await db.commit()
    await db.refresh(row)
    return row


async def add_correction(db: AsyncSession, user_id, document_id, office_id, note: str) -> Correction:
    """Record a 'this is wrong / office moved' flag. user_id may be None."""
    correction = Correction(
        user_id=user_id,
        document_id=document_id or None,
        office_id=office_id or None,
        note=note.strip(),
        created_at=_utc_now(),
    )
    db.add(correction)
    await db.commit()
    await db.refresh(correction)
    return correction
