"""
journey.py — Module 4: the guided journey.

GET /api/visa/journey → one ordered "% ready to apply" spine + the next action.

Aggregates state from the existing modules (via journey_state) and hands it to
journey_service, which owns the ordering/progress logic.
"""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.base import AuthUser
from database import get_db
from limiter import limiter
from services.user_service import get_user_by_auth_id
from services.journey_state import gather_journey_state
from services.journey_service import build_journey

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("")
@limiter.limit("60/minute")
async def get_journey(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        return JSONResponse(content=build_journey({}))

    state = await gather_journey_state(db, db_user)
    return JSONResponse(content=build_journey(state))
