"""
currency.py

Currency-conversion routes — a support layer for ParchiVisa's visa-readiness
financial (proof-of-funds) checks. The frontend calls these endpoints; it never
calls the external currency provider directly.

GET /currency/convert?from=PKR&to=GBP&amount=1000000
GET /currency/rates?base=PKR

Validation / error contract:
  - 400  malformed or unsupported currency, or amount <= 0
  - 502  external provider failed / unreachable
  - 503  provider API key not configured
"""

import logging

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from auth.dependencies import get_current_user
from auth.base import AuthUser
from limiter import limiter
from services.currency_service import (
    convert,
    get_rates,
    InvalidCurrencyError,
    InvalidAmountError,
    CurrencyConfigError,
    CurrencyProviderError,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _error_response(exc: Exception) -> JSONResponse:
    if isinstance(exc, (InvalidCurrencyError, InvalidAmountError)):
        return JSONResponse(status_code=400, content={"error": str(exc)})
    if isinstance(exc, CurrencyConfigError):
        # Misconfiguration on our side — surface as temporarily unavailable.
        logger.warning("Currency conversion not configured: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"error": "Currency conversion is temporarily unavailable."},
        )
    # CurrencyProviderError and anything unexpected → bad gateway.
    logger.warning("Currency provider failure: %s", exc)
    return JSONResponse(
        status_code=502,
        content={"error": "Currency provider is temporarily unavailable."},
    )


@router.get("/convert")
@limiter.limit("30/minute")
async def convert_currency(
    request: Request,
    from_: str = Query(..., alias="from", description="Source currency (e.g. PKR)"),
    to: str = Query(..., description="Target currency (e.g. GBP)"),
    amount: float = Query(..., description="Amount in the source currency; must be > 0"),
    current_user: AuthUser = Depends(get_current_user),
):
    try:
        return convert(from_, to, amount)
    except (InvalidCurrencyError, InvalidAmountError, CurrencyConfigError, CurrencyProviderError) as exc:
        return _error_response(exc)


@router.get("/rates")
@limiter.limit("30/minute")
async def currency_rates(
    request: Request,
    base: str = Query("PKR", description="Base currency (default PKR)"),
    current_user: AuthUser = Depends(get_current_user),
):
    try:
        return get_rates(base)
    except (InvalidCurrencyError, InvalidAmountError, CurrencyConfigError, CurrencyProviderError) as exc:
        return _error_response(exc)
