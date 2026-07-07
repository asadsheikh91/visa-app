"""
services/report_cache.py

Constraint #4: narration is generated once, then cached; the download path makes
ZERO LLM calls. Determinism is guaranteed by this cache, not by temperature.

What is cached HERE (in Redis): the NARRATION only — the list of per-finding prose
objects. Narration is deterministic for a given (engine_output, templateVersion,
promptVersion) and contains NO applicant PII, so it is safe to cache and to share
across users who produced identical findings.

What is NOT cached here: the full ReportData (which embeds applicant PII). That is
persisted per-user and Fernet-encrypted in Postgres (models.Report) — see
services/report_builder.py.

Cache key = sha256(canonical_json(engine_output) + templateVersion + promptVersion).

Redis is optional (graceful degradation, mirroring services/visa_data_service):
if REDIS_URL is unset or Redis is unreachable, cache_get returns None and cache_set
is a no-op — narration is simply recomputed (deterministic fallback is cheap).
"""

from __future__ import annotations

import hashlib
import json
import logging
import os

logger = logging.getLogger(__name__)

# Narration for a given key can't change unless a version bumps (which changes the
# key), so the TTL only bounds cache size, not correctness. 30 days.
_TTL_SECONDS = 60 * 60 * 24 * 30
_KEY_PREFIX = "report:narration:"

_redis_client = None
_redis_init = False


def compute_cache_key(
    engine_output: dict,
    template_version: str,
    prompt_version: str,
) -> str:
    """sha256 over canonical engine output + the two versions. Stable + order-free."""
    canonical = json.dumps(engine_output, sort_keys=True, separators=(",", ":"), default=str)
    material = f"{canonical}\x1e{template_version}\x1e{prompt_version}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def _get_redis():
    """Lazy singleton Redis client; None (never raises) if unset/unreachable."""
    global _redis_client, _redis_init
    if _redis_init:
        return _redis_client
    _redis_init = True

    redis_url = os.getenv("REDIS_URL", "").strip()
    if not redis_url:
        return None
    try:
        import redis as _redis

        client = _redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2)
        client.ping()
        _redis_client = client
    except Exception as exc:  # noqa: BLE001 - degrade to no cache
        logger.warning("Report narration cache disabled: Redis unavailable (%s).", type(exc).__name__)
        _redis_client = None
    return _redis_client


def get_cached_narration(cache_key: str) -> list[dict] | None:
    """Return the cached narration list for `cache_key`, or None on miss/error."""
    client = _get_redis()
    if client is None:
        return None
    try:
        raw = client.get(_KEY_PREFIX + cache_key)
        if not raw:
            return None
        data = json.loads(raw)
        return data if isinstance(data, list) else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Report narration cache read failed (%s).", type(exc).__name__)
        return None


def set_cached_narration(cache_key: str, narrations: list[dict]) -> None:
    """Store the narration list under `cache_key`. No-op on error. PII-free by design."""
    client = _get_redis()
    if client is None:
        return
    try:
        client.set(
            _KEY_PREFIX + cache_key,
            json.dumps(narrations, ensure_ascii=False, separators=(",", ":")),
            ex=_TTL_SECONDS,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Report narration cache write failed (%s).", type(exc).__name__)


def _reset_for_tests() -> None:
    """Test hook: drop the memoized client so a patched REDIS_URL takes effect."""
    global _redis_client, _redis_init
    _redis_client = None
    _redis_init = False
