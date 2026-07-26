"""
auth/dependencies.py

FastAPI dependency for protecting routes.
"""

import logging

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from auth.base import AuthError, AuthUser
from auth.provider import get_auth_provider
from database import get_db
from services.admin import is_admin
from services.user_service import get_user_by_auth_id, upsert_user

logger = logging.getLogger(__name__)
_bearer = HTTPBearer(auto_error=True)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> AuthUser:
    """
    FastAPI dependency — verifies the Bearer token, upserts the user in DB,
    and returns the authenticated user.
    Raises 401 if the token is missing, invalid, or expired.
    """
    provider = get_auth_provider()
    try:
        auth_user = provider.verify_token(credentials.credentials)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Expose the verified user id to the rate limiter so it can key by account
    # rather than IP (see limiter.py). This is purely for rate-limit accounting
    # and is never used for an authorization decision.
    request.state.auth_user_id = auth_user.user_id

    if not auth_user.email:
        try:
            import asyncio
            auth_user.email = await asyncio.to_thread(provider.fetch_email, auth_user.user_id)
        except Exception:
            pass

    try:
        await upsert_user(db, auth_user)
    except Exception as exc:
        await db.rollback()
        logger.exception(
            "Authenticated request succeeded but upserting user %s failed",
            auth_user.user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist authenticated user. Please try again.",
        ) from exc

    return auth_user


async def get_admin_user(
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    FastAPI dependency for the operator admin panel. Verifies the session (via
    get_current_user), then authorizes against the ADMIN_EMAILS allowlist. Returns
    the DB `User` row (admin routes need it). 403 for any non-allowlisted account.

    Authorization is checked against the persisted email (get_current_user upserts
    it) with the token-claim email as a fallback — either matching the allowlist
    grants access. This is enforced on EVERY admin route; the frontend gate is a
    convenience only.
    """
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    email = (db_user.email if db_user else None) or current_user.email
    if not is_admin(email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return db_user
