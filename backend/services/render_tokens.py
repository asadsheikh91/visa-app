"""
services/render_tokens.py

Single-use, short-TTL "render tokens" that let the server-side Playwright step load
the print route WITHOUT a Clerk session.

Why this exists: the PDF is produced by Playwright rendering the same print route the
browser uses. Headless Chromium has no Clerk login, so it cannot call the normal
Clerk-authenticated report endpoint. Instead, the authenticated `/pdf` route (owner
+ paid, already verified) mints a render token, and Playwright loads
`/report/{token}/print?rt=<render_token>`. The print page exchanges that token at the
Clerk-free `/reports/{token}/render` endpoint, which validates it here.

Security properties:
  - Minted ONLY after ownership + plan are verified on the /pdf route.
  - Single-use: consume() deletes it, so it cannot be replayed.
  - Short TTL (default 120s): a leaked token is useless almost immediately.
  - Opaque (secrets.token_urlsafe) and bound to exactly one report token.

Storage: Redis when configured (works across instances); otherwise an in-process
dict with expiry (fine for single-instance dev). Never raises.
"""

from __future__ import annotations

import logging
import secrets
import time

from services import report_cache

logger = logging.getLogger(__name__)

_TTL_DEFAULT = 120
_PREFIX = "report:rendertoken:"

# In-process fallback: rt -> (report_token, expiry_epoch). Used only when Redis is
# not configured/available.
_local: dict[str, tuple[str, float]] = {}


def mint(report_token: str, ttl: int = _TTL_DEFAULT) -> str:
    """Create a single-use render token bound to `report_token`."""
    rt = secrets.token_urlsafe(24)
    client = report_cache._get_redis()
    if client is not None:
        try:
            client.setex(_PREFIX + rt, ttl, report_token)
            return rt
        except Exception as exc:  # noqa: BLE001 - fall back to local store
            logger.warning("Render-token Redis write failed (%s); using local store.", type(exc).__name__)
    _local[rt] = (report_token, time.time() + ttl)
    return rt


def consume(rt: str) -> str | None:
    """
    Return the report token bound to `rt` and INVALIDATE it (single use). Returns
    None if the token is unknown, already used, or expired.
    """
    if not rt:
        return None

    client = report_cache._get_redis()
    if client is not None:
        try:
            key = _PREFIX + rt
            val = client.get(key)
            if val is not None:
                client.delete(key)
                return val.decode("utf-8") if isinstance(val, (bytes, bytearray)) else str(val)
        except Exception as exc:  # noqa: BLE001 - fall through to local store
            logger.warning("Render-token Redis read failed (%s).", type(exc).__name__)

    entry = _local.pop(rt, None)
    if entry is None:
        return None
    report_token, expiry = entry
    if time.time() > expiry:
        return None
    return report_token


def _reset_for_tests() -> None:
    """Test hook: clear the in-process store."""
    _local.clear()
