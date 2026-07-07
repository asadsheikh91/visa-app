"""
profile_service.py

CRUD for UserVisaProfile — the onboarding / personalisation record tied to each
authenticated user. One profile per user (unique on user_id).

Public API:
  get_profile(db, user)           → UserVisaProfile | None
  upsert_profile(db, user, data)  → UserVisaProfile
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, UserVisaProfile

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def get_profile(db: AsyncSession, user: User) -> UserVisaProfile | None:
    result = await db.execute(
        select(UserVisaProfile).where(UserVisaProfile.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def upsert_profile(db: AsyncSession, user: User, data: dict) -> UserVisaProfile:
    """
    Create-or-update the user's visa profile.  `data` is a dict of column names
    to values; keys absent from `data` leave existing column values unchanged.
    Always updates `updated_at` to now.
    """
    profile = await get_profile(db, user)

    if profile is None:
        now = _utc_now()
        profile = UserVisaProfile(
            user_id=user.id,
            created_at=now,
            updated_at=now,
            **data,
        )
        db.add(profile)
        logger.info("Creating new profile for user_id=%s", user.id)
    else:
        for key, value in data.items():
            setattr(profile, key, value)
        profile.updated_at = _utc_now()
        logger.info("Updating profile for user_id=%s", user.id)

    await db.commit()
    await db.refresh(profile)
    return profile
