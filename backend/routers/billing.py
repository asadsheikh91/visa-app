"""
routers/billing.py

Gumroad → plan entitlement. A Gumroad "Ping"/resource webhook POSTs form-encoded
sale data here; on a valid sale we set the buyer's User.plan to the paid tier (which
services.entitlements.has_report_access gates the Readiness Report on), and on a
refund/dispute/cancellation we downgrade to "free".

Verification (Gumroad pings are not signed): a shared secret is required. Configure
GUMROAD_WEBHOOK_SECRET and append it to the ping URL (…/webhook?secret=…) or send it
as the X-Gumroad-Secret header; it is compared in constant time. If the secret is
not configured, the endpoint is disabled (503) so it can never be an open plan-grant.
Optionally restrict to your GUMROAD_SELLER_ID and GUMROAD_PRODUCT_ID.

PII: the buyer email is used only to match the account and is NEVER logged.
"""

import hmac
import logging
import os

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from database import get_db
from limiter import limiter
from services.user_service import set_plan_for_purchase

logger = logging.getLogger(__name__)
router = APIRouter()

_PAID_PLAN = os.getenv("GUMROAD_PLAN", "pro").strip() or "pro"

# Gumroad fields / resource_name values that mean "revoke access".
_REVOKE_RESOURCES = {"refund", "dispute", "cancellation", "subscription_ended"}
_TRUTHY = {"true", "1", "yes"}


def _cfg(name: str) -> str:
    return os.getenv(name, "").strip()


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in _TRUTHY


def _secret_ok(request: Request, form) -> bool:
    configured = _cfg("GUMROAD_WEBHOOK_SECRET")
    if not configured:
        return False  # feature disabled — never grant without a configured secret
    provided = (
        request.query_params.get("secret")
        or request.headers.get("X-Gumroad-Secret")
        or form.get("secret")
        or ""
    )
    return hmac.compare_digest(str(provided), configured)


@router.post("/gumroad/webhook")
@limiter.limit("120/minute")
async def gumroad_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    # Endpoint disabled unless a secret is configured.
    if not _cfg("GUMROAD_WEBHOOK_SECRET"):
        return JSONResponse(status_code=503, content={"error": "Billing webhook is not configured."})

    try:
        form = await request.form()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid webhook payload."})

    if not _secret_ok(request, form):
        return JSONResponse(status_code=403, content={"error": "Invalid webhook secret."})

    # Optional origin restrictions.
    want_seller = _cfg("GUMROAD_SELLER_ID")
    if want_seller and str(form.get("seller_id", "")) != want_seller:
        return JSONResponse(status_code=403, content={"error": "Unrecognized seller."})

    want_product = _cfg("GUMROAD_PRODUCT_ID")
    if want_product:
        product = str(form.get("product_id", "")) or str(form.get("product_permalink", ""))
        if product != want_product:
            # Not our product — acknowledge so Gumroad doesn't retry, but do nothing.
            return JSONResponse(content={"ok": True, "ignored": "product"})

    email = str(form.get("email", "")).strip()
    if not email:
        return JSONResponse(content={"ok": True, "ignored": "no-email"})

    resource = str(form.get("resource_name", "")).strip().lower()
    revoked = (
        resource in _REVOKE_RESOURCES
        or _truthy(form.get("refunded"))
        or _truthy(form.get("disputed"))
        or _truthy(form.get("cancelled"))
    )
    plan = "free" if revoked else _PAID_PLAN

    try:
        updated = await set_plan_for_purchase(db, email, plan)
    except Exception:
        await db.rollback()
        logger.exception("Gumroad webhook: failed to apply plan change.")
        return JSONResponse(status_code=500, content={"error": "Failed to apply entitlement."})

    # Log the outcome WITHOUT the email (PII).
    logger.info("Gumroad webhook applied: plan=%s revoked=%s matched=%s", plan, revoked, updated)
    return JSONResponse(content={"ok": True, "plan": plan, "matched": updated})
