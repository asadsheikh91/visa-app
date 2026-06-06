"""
services/user_service.py

User persistence helpers: upsert on auth, save visa check results, fetch history.
Provider-agnostic: works with any AuthUser (Clerk, Auth0, Supabase, etc.)

Phase 4B: save_visa_check now persists the full engine result including
high_risk_flags, soft_warnings, normalized_answers, and sources_used.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models import User, VisaCheck
from auth.base import AuthUser


async def get_or_create_user(
    db: AsyncSession,
    auth_user_id: str,
    email: str | None = None,
) -> User:
    """
    Look up a user by auth_user_id and create one if needed.
    Uses the internal UUID primary key for later visa-check persistence.
    """
    email = email.strip() if isinstance(email, str) and email.strip() else None

    result = await db.execute(
        select(User).where(User.auth_user_id == auth_user_id)
    )
    user: User | None = result.scalar_one_or_none()

    if user is None:
        user = User(
            auth_user_id=auth_user_id,
            email=email,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    if email and user.email != email:
        user.email = email
        await db.commit()
        await db.refresh(user)

    return user


async def upsert_user(db: AsyncSession, auth_user: AuthUser) -> User:
    """
    Find or create a User row by auth_user_id (the provider's sub claim).
    If the user already exists, update their email if it has changed.
    """
    return await get_or_create_user(db, auth_user.user_id, auth_user.email)


async def get_user_by_auth_id(db: AsyncSession, auth_user_id: str) -> User | None:
    """Look up a DB user by their Clerk sub claim. Returns None if not found."""
    result = await db.execute(
        select(User).where(User.auth_user_id == auth_user_id)
    )
    return result.scalar_one_or_none()


async def save_visa_check(
    db: AsyncSession,
    db_user: User,
    country: str,
    visa_type: str,
    result_data: dict,
) -> VisaCheck:
    """
    Persist a completed visa readiness check using the internal user UUID.

    Phase 4B: persists the full engine result including the Phase 4A fields
    (high_risk_flags, soft_warnings, normalized_answers, sources_used).
    Fields absent from result_data default to [] or {} to keep columns clean.

    Raises on error so the caller can return an explicit failure response.
    """
    check = VisaCheck(
        user_id             = db_user.id,
        country             = country,
        visa_type           = visa_type,
        score               = result_data["score"],
        result              = result_data["result"],
        result_description  = result_data.get("result_description"),
        # Phase 1 fields
        critical_blockers   = result_data.get("critical_blockers",   []),
        warnings            = result_data.get("warnings",            []),
        recommendations     = result_data.get("recommendations",     []),
        # Phase 4B fields
        high_risk_flags     = result_data.get("high_risk_flags",     []),
        soft_warnings       = result_data.get("soft_warnings",       []),
        normalized_answers  = result_data.get("normalized_answers",  {}),
        sources_used        = result_data.get("sources_used",        []),
    )
    db.add(check)
    try:
        await db.commit()
        await db.refresh(check)
    except Exception:
        await db.rollback()
        raise
    return check


async def get_user_checks(
    db: AsyncSession,
    db_user: User,
    limit: int = 20,
) -> list[VisaCheck]:
    """Return the user's most recent visa checks, newest first."""
    result = await db.execute(
        select(VisaCheck)
        .where(VisaCheck.user_id == db_user.id)
        .order_by(VisaCheck.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
