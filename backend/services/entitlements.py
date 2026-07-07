"""
entitlements.py

Phase 2.0: usage/quota scaffolding so the AI features are free now but can be
gated behind a paywall later without structural rework.

Design:
  - Every user has a `plan` (default "free"; see models.User).
  - FREE_LIMITS caps daily usage per feature for free users.
  - check_quota counts *today's* rows in the feature's own table (no separate
    usage table needed — SopReview / InterviewSession rows ARE the usage log).
  - The feature's model is passed in by the router, so this module stays
    decoupled from models that are added later (no circular imports).

To add a paid tier later: set User.plan on payment and branch on it here
(e.g. unlimited for "pro"). The router contract does not change.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import User

logger = logging.getLogger(__name__)

# Daily allowance per feature for the free plan.
FREE_LIMITS: dict[str, int] = {
    "sop_review":         3,
    "interview":          1,
    "financial_document": 5,
}


def has_report_access(user: User) -> bool:
    """
    True when the user may generate / download a Readiness Report.

    Plan-based gate (constraint #7): reports are a paid feature, so any non-"free"
    plan qualifies. The actual purchase→plan upgrade (Gumroad webhook) is wired
    separately; this function is the single place the paywall is enforced, so that
    integration only has to set User.plan.
    """
    return bool(getattr(user, "plan", "free")) and user.plan != "free"


def _today_start() -> datetime:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def limit_for(user: User, feature: str) -> int:
    """Daily limit for this user + feature. Paid plans can override here later."""
    if getattr(user, "plan", "free") and user.plan != "free":
        return 10_000  # effectively unlimited for paid plans
    return FREE_LIMITS.get(feature, 0)


async def count_today(db: AsyncSession, model, user: User) -> int:
    """Count rows of `model` created today for `user` (model needs user_id + created_at)."""
    result = await db.execute(
        select(func.count())
        .select_from(model)
        .where(model.user_id == user.id, model.created_at >= _today_start())
    )
    return int(result.scalar_one() or 0)


async def check_quota(db: AsyncSession, user: User, feature: str, model) -> tuple[bool, int]:
    """
    Returns (allowed, remaining) for `user` on `feature`.

    `model` is the feature's SQLAlchemy table (e.g. SopReview) — its rows are the
    usage record. Allowed is True when today's usage is below the daily limit.
    """
    limit = limit_for(user, feature)
    if limit <= 0:
        return False, 0
    used = await count_today(db, model, user)
    remaining = max(0, limit - used)
    return used < limit, remaining
