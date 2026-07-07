"""
limiter.py

Shared slowapi rate limiter instance.
Imported by main.py (registers the exception handler) and by routers
(applies @limiter.limit() decorators).

Storage: Redis when REDIS_URL is configured, so per-route limits are enforced
*consistently across every worker process / instance* (in-memory storage would
give each worker its own private counters, multiplying the effective allowance).
If REDIS_URL is unset (local dev / tests) it uses in-memory storage. When Redis
*is* configured but unreachable, slowapi's in_memory_fallback_enabled keeps the
API serving on per-process in-memory counters instead of erroring — the same
graceful-degradation posture the visa-data cache uses for Redis.

Key function: authenticated requests are keyed by the Clerk user id (set on
request.state by auth.dependencies.get_current_user once the JWT is verified), so
a single account can't multiply its allowance by rotating IP addresses. Requests
with no verified user (only the unauthenticated liveness routes) fall back to the
client IP.

NOTE: this module calls load_dotenv() itself because main.py imports it before
it calls load_dotenv(); without this, REDIS_URL from backend/.env would be
invisible at limiter-construction time. (database.py loads dotenv the same way.)
"""
import logging
import os

from dotenv import load_dotenv
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

load_dotenv()
logger = logging.getLogger(__name__)


def _identify_client(request: Request) -> str:
    """Per-user key when authenticated, else per-IP. See module docstring."""
    user_id = getattr(request.state, "auth_user_id", None)
    if user_id:
        return f"user:{user_id}"
    return get_remote_address(request)


def _build_limiter() -> Limiter:
    redis_url = os.getenv("REDIS_URL", "").strip()
    if redis_url:
        # in_memory_fallback_enabled: if Redis is unreachable (at startup or
        # mid-flight), slowapi serves limits from in-memory counters instead of
        # raising — a Redis blip degrades limit *consistency*, not availability.
        return Limiter(
            key_func=_identify_client,
            storage_uri=redis_url,
            in_memory_fallback_enabled=True,
        )
    return Limiter(key_func=_identify_client)


limiter = _build_limiter()
