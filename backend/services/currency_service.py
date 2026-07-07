"""
currency_service.py

Estimated currency conversion for ParchiVisa's visa-readiness financial checks
(proof-of-funds comparisons). This is a SUPPORT feature, not a general-purpose
converter.

Design:
  - Provider: open.er-api.com — ExchangeRate-API's free, keyless "open access"
    endpoint (https://www.exchangerate-api.com/docs/free). No API key is needed,
    and crucially it carries PKR (the user's home currency), which ECB-based
    feeds like Frankfurter do not.
  - The external API is reached with the Python standard library (urllib) — no
    extra HTTP dependency is added. All external access goes through
    `_fetch_rates_from_provider`, which is the single mock point in tests.
  - Caching: Redis (same lazy, graceful pattern as visa_data_service). Per-pair
    keys like `currency:rate:PKR:GBP`, TTL 6 hours. If Redis is not configured or
    unreachable, the service degrades to a direct provider fetch — it never
    raises because of a missing cache.
  - Validation: 3-letter uppercase codes restricted to a supported allowlist;
    amount must be > 0. Invalid input raises ValueError subclasses (→ HTTP 400);
    provider problems raise CurrencyProviderError (→ HTTP 502). CurrencyConfigError
    (→ HTTP 503) is retained for the router contract but is no longer raised here,
    since the open endpoint needs no key.

Nothing here touches visa scoring — it is a display/comparison helper only.
"""

import json
import os
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

import redis as _redis

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROVIDER_NAME = "ExchangeRate-API"

# The only currencies ParchiVisa supports right now. PKR is the user's home
# currency; the rest are the four study-destination currencies.
SUPPORTED_CURRENCIES: frozenset[str] = frozenset({"PKR", "GBP", "USD", "CAD", "AUD"})

# Visa-relevant targets always returned by /currency/rates (minus the base).
VISA_CURRENCIES: tuple[str, ...] = ("GBP", "USD", "CAD", "AUD")

# Free, keyless open-access endpoint. Shape: GET {base}/latest/{BASE} →
# {"result": "success", "rates": {"USD": .., ...}, "time_last_update_unix": ..}.
_PROVIDER_BASE_URL = "https://open.er-api.com/v6"
_HTTP_TIMEOUT = 6  # seconds
_CACHE_TTL = 6 * 60 * 60  # 6 hours
_RATE_DECIMALS = 8


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class InvalidCurrencyError(ValueError):
    """Currency code is malformed or not in the supported allowlist (→ 400)."""


class InvalidAmountError(ValueError):
    """Amount is missing or not greater than zero (→ 400)."""


class CurrencyConfigError(RuntimeError):
    """The provider API key is not configured (→ 503)."""


class CurrencyProviderError(RuntimeError):
    """The external provider failed or returned an unusable response (→ 502)."""


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _normalize_currency(code: Any) -> str:
    if not isinstance(code, str):
        raise InvalidCurrencyError("Currency code must be a 3-letter code.")
    normalized = code.strip().upper()
    if len(normalized) != 3 or not normalized.isalpha():
        raise InvalidCurrencyError(
            f"'{code}' is not a valid 3-letter currency code."
        )
    if normalized not in SUPPORTED_CURRENCIES:
        supported = ", ".join(sorted(SUPPORTED_CURRENCIES))
        raise InvalidCurrencyError(
            f"Currency '{normalized}' is not supported. Supported: {supported}."
        )
    return normalized


def _validate_amount(amount: Any) -> float:
    try:
        value = float(amount)
    except (TypeError, ValueError):
        raise InvalidAmountError("Amount must be a number greater than 0.")
    if value <= 0:
        raise InvalidAmountError("Amount must be greater than 0.")
    return value


# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _to_iso(unix_ts: Any) -> str:
    try:
        return datetime.fromtimestamp(int(unix_ts), tz=timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
    except (TypeError, ValueError, OSError, OverflowError):
        return _now_iso()


# ---------------------------------------------------------------------------
# Redis cache (lazy singleton; never raises — degrades to provider fetch)
# ---------------------------------------------------------------------------

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        return None
    try:
        _redis_client = _redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        return _redis_client
    except Exception:
        return None


def _cache_key(base: str, target: str) -> str:
    return f"currency:rate:{base}:{target}"


def _cache_get_pair(base: str, target: str) -> dict | None:
    client = _get_redis()
    if client is None:
        return None
    try:
        raw = client.get(_cache_key(base, target))
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return None


def _cache_set_pair(base: str, target: str, payload: dict) -> None:
    client = _get_redis()
    if client is None:
        return
    try:
        client.setex(_cache_key(base, target), _CACHE_TTL, json.dumps(payload))
    except Exception:
        pass  # cache write failure is non-fatal


# ---------------------------------------------------------------------------
# Provider — the single external-API call (mocked in tests)
# ---------------------------------------------------------------------------

def _fetch_rates_from_provider(base: str) -> tuple[dict[str, float], str]:
    """
    Fetch the latest conversion rates for `base` from open.er-api.com
    (ExchangeRate-API's free, keyless open-access endpoint).

    Returns (rates, last_updated_iso).
    Raises CurrencyProviderError on any network/parse/provider error. No API key
    is required, so there is no config-error path here.
    """
    url = f"{_PROVIDER_BASE_URL}/latest/{base}"
    try:
        req = UrlRequest(url, headers={"Accept": "application/json"})
        with urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
        raise CurrencyProviderError("Currency provider request failed.") from exc

    if not isinstance(payload, dict) or payload.get("result") != "success":
        detail = ""
        if isinstance(payload, dict):
            detail = str(payload.get("error-type", ""))
        raise CurrencyProviderError(
            f"Currency provider returned an error.{(' ' + detail) if detail else ''}"
        )

    # The open endpoint nests rates under "rates" (the keyed v6 API used
    # "conversion_rates" — different field, same meaning).
    rates = payload.get("rates")
    if not isinstance(rates, dict):
        raise CurrencyProviderError("Currency provider returned no rates.")

    return rates, _to_iso(payload.get("time_last_update_unix"))


def _populate_cache(base: str, provider_rates: dict, last_updated: str) -> None:
    for target in SUPPORTED_CURRENCIES:
        if target == base:
            continue
        rate = provider_rates.get(target)
        if isinstance(rate, (int, float)):
            _cache_set_pair(
                base,
                target,
                {
                    "rate": round(float(rate), _RATE_DECIMALS),
                    "last_updated": last_updated,
                    "provider": PROVIDER_NAME,
                },
            )


def _get_rate(base: str, target: str) -> tuple[float, str]:
    """Return (rate, last_updated_iso) for base→target, using cache when possible."""
    if base == target:
        return 1.0, _now_iso()

    cached = _cache_get_pair(base, target)
    if cached and isinstance(cached.get("rate"), (int, float)):
        return float(cached["rate"]), str(cached.get("last_updated") or _now_iso())

    provider_rates, last_updated = _fetch_rates_from_provider(base)
    _populate_cache(base, provider_rates, last_updated)

    rate = provider_rates.get(target)
    if not isinstance(rate, (int, float)):
        raise CurrencyProviderError(f"No rate available for {base}→{target}.")
    return round(float(rate), _RATE_DECIMALS), last_updated


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def convert(from_code: str, to_code: str, amount: Any) -> dict:
    """
    Convert `amount` from one supported currency to another.

    Raises InvalidCurrencyError / InvalidAmountError (→ 400),
    CurrencyConfigError (→ 503), CurrencyProviderError (→ 502).
    """
    base = _normalize_currency(from_code)
    target = _normalize_currency(to_code)
    value = _validate_amount(amount)

    rate, last_updated = _get_rate(base, target)
    converted_amount = round(value * rate, 2)

    return {
        "from": base,
        "to": target,
        "amount": value,
        "converted_amount": converted_amount,
        "rate": rate,
        "provider": PROVIDER_NAME,
        "last_updated": last_updated,
        "is_estimate": True,
    }


def get_rates(base_code: str = "PKR") -> dict:
    """
    Return rates from `base` to the visa-relevant currencies (GBP, USD, CAD, AUD),
    minus the base itself. One provider fetch covers all targets.
    """
    base = _normalize_currency(base_code)
    targets = [c for c in VISA_CURRENCIES if c != base]

    rates: dict[str, float] = {}
    last_updated: str | None = None

    # Use the cache if every target is present; otherwise one fetch fills them all.
    need_fetch = False
    for target in targets:
        cached = _cache_get_pair(base, target)
        if cached and isinstance(cached.get("rate"), (int, float)):
            rates[target] = float(cached["rate"])
            last_updated = str(cached.get("last_updated") or last_updated)
        else:
            need_fetch = True
            break

    if need_fetch:
        provider_rates, last_updated = _fetch_rates_from_provider(base)
        _populate_cache(base, provider_rates, last_updated)
        rates = {}
        for target in targets:
            rate = provider_rates.get(target)
            if not isinstance(rate, (int, float)):
                raise CurrencyProviderError(f"No rate available for {base}→{target}.")
            rates[target] = round(float(rate), _RATE_DECIMALS)

    return {
        "base": base,
        "rates": rates,
        "provider": PROVIDER_NAME,
        "last_updated": last_updated or _now_iso(),
        "is_estimate": True,
    }
