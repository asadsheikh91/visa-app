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
from services.user_service import upsert_user

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
