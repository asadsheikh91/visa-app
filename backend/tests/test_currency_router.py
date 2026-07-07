"""
tests/test_currency_router.py

Integration tests for routers/currency.py using FastAPI's TestClient.
The currency service is mocked at the import site in the router module, so no
network or Redis access occurs.

Covers the HTTP contract:
  - 200 valid convert
  - 200 valid rates
  - 400 invalid amount / unsupported currency
  - 502 provider failure
  - 503 missing API key
"""

from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from routers import currency
from auth.dependencies import get_current_user
from auth.base import AuthUser
import services.currency_service as cs


def _make_client():
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(currency.router, prefix="/currency")
    # /currency/* now requires a Clerk JWT (auth tied to an account, not just an
    # IP). Override the auth dependency so these HTTP-contract tests stay focused
    # on the currency behaviour without standing up real JWT verification.
    app.dependency_overrides[get_current_user] = lambda: AuthUser(user_id="test_user", email=None)
    return TestClient(app, raise_server_exceptions=False)


_VALID_CONVERT = {
    "from": "PKR",
    "to": "GBP",
    "amount": 1_000_000,
    "converted_amount": 2850.25,
    "rate": 0.00285025,
    "provider": "ExchangeRate-API",
    "last_updated": "2026-06-13T00:00:00Z",
    "is_estimate": True,
}


def test_convert_ok():
    client = _make_client()
    with patch.object(currency, "convert", return_value=_VALID_CONVERT):
        resp = client.get("/currency/convert", params={"from": "PKR", "to": "GBP", "amount": 1_000_000})
    assert resp.status_code == 200
    assert resp.json()["converted_amount"] == 2850.25


def test_rates_ok():
    client = _make_client()
    payload = {
        "base": "PKR",
        "rates": {"GBP": 0.00285, "USD": 0.0036, "CAD": 0.0049, "AUD": 0.0054},
        "provider": "ExchangeRate-API",
        "last_updated": "2026-06-13T00:00:00Z",
        "is_estimate": True,
    }
    with patch.object(currency, "get_rates", return_value=payload):
        resp = client.get("/currency/rates", params={"base": "PKR"})
    assert resp.status_code == 200
    assert set(resp.json()["rates"].keys()) == {"GBP", "USD", "CAD", "AUD"}


def test_convert_invalid_amount_returns_400():
    client = _make_client()
    with patch.object(currency, "convert", side_effect=cs.InvalidAmountError("Amount must be greater than 0.")):
        resp = client.get("/currency/convert", params={"from": "PKR", "to": "GBP", "amount": 5})
    assert resp.status_code == 400
    assert "error" in resp.json()


def test_convert_unsupported_currency_returns_400():
    client = _make_client()
    with patch.object(currency, "convert", side_effect=cs.InvalidCurrencyError("unsupported")):
        resp = client.get("/currency/convert", params={"from": "PKR", "to": "EUR", "amount": 1000})
    assert resp.status_code == 400


def test_convert_provider_failure_returns_502():
    client = _make_client()
    with patch.object(currency, "convert", side_effect=cs.CurrencyProviderError("down")):
        resp = client.get("/currency/convert", params={"from": "PKR", "to": "GBP", "amount": 1000})
    assert resp.status_code == 502


def test_convert_missing_key_returns_503():
    client = _make_client()
    with patch.object(currency, "convert", side_effect=cs.CurrencyConfigError("no key")):
        resp = client.get("/currency/convert", params={"from": "PKR", "to": "GBP", "amount": 1000})
    assert resp.status_code == 503
