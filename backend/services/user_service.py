"""
services/user_service.py

User persistence helpers: upsert on auth, save visa check results, fetch history.
Provider-agnostic: works with any AuthUser (Clerk, Auth0, Supabase, etc.)

Phase 4B: save_visa_check now persists the full engine result including
high_risk_flags, soft_warnings, normalized_answers, and sources_used.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

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

    Account claiming: a purchase can arrive (via the Gumroad webhook) BEFORE the
    buyer has ever signed in, which pre-provisions an email-only User row (with the
    paid plan and no auth_user_id). On that user's first Clerk login we CLAIM that
    row — attaching auth_user_id — instead of creating a duplicate, so the paid plan
    they already bought carries over. See services.user_service.set_plan_for_purchase.
    """
    email = email.strip() if isinstance(email, str) and email.strip() else None

    result = await db.execute(
        select(User).where(User.auth_user_id == auth_user_id)
    )
    user: User | None = result.scalar_one_or_none()

    if user is not None:
        if email and user.email != email:
            user.email = email
            await db.commit()
            await db.refresh(user)
        return user

    # Claim a pre-provisioned, email-only row (e.g. from a pre-signup purchase).
    if email:
        pre = await db.execute(
            select(User).where(
                User.auth_user_id.is_(None),
                func.lower(User.email) == email.lower(),
            )
        )
        pre_user: User | None = pre.scalar_one_or_none()
        if pre_user is not None:
            pre_user.auth_user_id = auth_user_id
            pre_user.email = email
            await db.commit()
            await db.refresh(pre_user)
            return pre_user

    user = User(auth_user_id=auth_user_id, email=email)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def set_plan_for_purchase(db: AsyncSession, email: str, plan: str) -> bool:
    """
    Set a user's billing plan from a purchase event (Gumroad webhook), matched by
    email (case-insensitive). Returns True if a user row was updated/created.

    - If a user with that email exists → update their plan.
    - If none exists AND this is an upgrade (plan != "free") → PRE-PROVISION an
      email-only row carrying the plan, which get_or_create_user claims on first
      login. A downgrade for an unknown email is a no-op (nothing to downgrade).

    Never logs the email (PII). The caller acknowledges the webhook regardless.
    """
    email = (email or "").strip()
    if not email:
        return False

    result = await db.execute(
        select(User).where(func.lower(User.email) == email.lower())
    )
    user: User | None = result.scalar_one_or_none()

    if user is not None:
        if user.plan != plan:
            user.plan = plan
            await db.commit()
        return True

    if plan == "free":
        return False  # nothing to downgrade

    db.add(User(email=email, plan=plan))
    await db.commit()
    return True


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
