"""
timeline_service.py

Persistence + serialization for the Timeline & Deadline Planner (Module C).

  - get_timeline:        the user's timeline, or None.
  - create_or_replace:   (re)generate from an intake date + country, carrying
                         over the user's per-milestone status/note edits for
                         milestones that still exist.
  - update_milestone:    edit a single milestone's status/note.
  - serialize_timeline:  add derived progress stats + the next due milestone.

The milestone *rules* live in timeline_engine; this module only handles state.
"""

import logging
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, VisaTimeline
from services.timeline_engine import (
    build_timeline,
    VALID_TIMELINE_STATUSES,
)

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_intake_date(value: str) -> date:
    """Parse an ISO 'YYYY-MM-DD' intake date. Raises ValueError on bad input."""
    try:
        return date.fromisoformat((value or "").strip())
    except ValueError as exc:
        raise ValueError("Intake date must be a valid date (YYYY-MM-DD).") from exc


async def get_timeline(db: AsyncSession, user: User) -> VisaTimeline | None:
    result = await db.execute(
        select(VisaTimeline).where(VisaTimeline.user_id == user.id)
    )
    return result.scalar_one_or_none()


def _carry_over_edits(new_ms: list[dict], previous: list[dict] | None) -> list[dict]:
    """Preserve status/note for milestones that survive a regeneration."""
    prev: dict[str, dict] = {}
    for m in (previous or []):
        mid = m.get("id")
        if mid:
            prev[mid] = m
    out = []
    for m in new_ms:
        old = prev.get(m["id"])
        if old:
            if old.get("status") in VALID_TIMELINE_STATUSES:
                m["status"] = old["status"]
            if old.get("note"):
                m["note"] = old["note"]
        out.append(m)
    return out


async def create_or_replace(
    db: AsyncSession, user: User, country: str, intake_date_str: str
) -> VisaTimeline:
    """Generate (or regenerate) the user's timeline from an intake date + country."""
    intake = parse_intake_date(intake_date_str)
    milestones = build_timeline(intake, country)

    existing = await get_timeline(db, user)
    now = _utc_now()
    if existing is None:
        timeline = VisaTimeline(
            user_id=user.id,
            country=(country or "").lower().strip(),
            intake_date=intake.isoformat(),
            milestones=milestones,
            created_at=now,
            updated_at=now,
        )
        db.add(timeline)
    else:
        timeline = existing
        timeline.milestones = _carry_over_edits(milestones, existing.milestones)
        timeline.country = (country or "").lower().strip()
        timeline.intake_date = intake.isoformat()
        timeline.updated_at = now

    await db.commit()
    await db.refresh(timeline)
    logger.info("Built timeline %s for user=%s (%d milestones)",
                timeline.id, user.id, len(timeline.milestones))
    return timeline


async def update_milestone(
    db: AsyncSession,
    timeline: VisaTimeline,
    milestone_id: str,
    status: str | None = None,
    note: str | None = None,
) -> VisaTimeline:
    """Edit one milestone's status and/or note. Raises ValueError on bad input."""
    if status is not None and status not in VALID_TIMELINE_STATUSES:
        raise ValueError(f"Invalid status '{status}'.")

    items = list(timeline.milestones or [])
    found = False
    new_items = []
    for m in items:
        if m.get("id") == milestone_id:
            m = dict(m)
            if status is not None:
                m["status"] = status
            if note is not None:
                m["note"] = note
            found = True
        new_items.append(m)

    if not found:
        raise ValueError(f"Milestone '{milestone_id}' not found in this timeline.")

    timeline.milestones = new_items   # reassign so SQLAlchemy detects the change
    timeline.updated_at = _utc_now()
    await db.commit()
    await db.refresh(timeline)
    return timeline


def serialize_timeline(timeline: VisaTimeline) -> dict:
    milestones = list(timeline.milestones or [])
    done = sum(1 for m in milestones if m.get("status") in ("done", "skipped"))
    total = len(milestones)
    # Next due = soonest milestone not yet done/skipped.
    pending = [m for m in milestones if m.get("status") not in ("done", "skipped")]
    pending.sort(key=lambda m: m.get("due_date", ""))
    next_due = pending[0] if pending else None

    return {
        "id":          str(timeline.id),
        "country":     timeline.country,
        "intake_date": timeline.intake_date,
        "milestones":  milestones,
        "stats": {
            "total":         total,
            "done":          done,
            "remaining":     total - done,
            "completion_pct": round(done / total * 100) if total else 0,
        },
        "next_due":    next_due,
        "created_at":  timeline.created_at.isoformat(),
        "updated_at":  timeline.updated_at.isoformat(),
    }
