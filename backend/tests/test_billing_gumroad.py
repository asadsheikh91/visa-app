"""
tests/test_billing_gumroad.py

Gumroad webhook → plan entitlement. Verifies the shared-secret gate, sale →
upgrade, refund/dispute → downgrade, optional seller/product restrictions, and
that the buyer email is passed through to the entitlement layer (which is mocked;
no DB). Uses FastAPI TestClient with get_db overridden.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from database import get_db
from limiter import limiter
from routers import billing

_SECRET = "s3cr3t-webhook"


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv("GUMROAD_WEBHOOK_SECRET", _SECRET)
    monkeypatch.delenv("GUMROAD_SELLER_ID", raising=False)
    monkeypatch.delenv("GUMROAD_PRODUCT_ID", raising=False)
    monkeypatch.setattr(billing, "_PAID_PLAN", "pro")


def _client():
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(billing.router, prefix="/api/billing")
    app.dependency_overrides[get_db] = lambda: MagicMock()
    return TestClient(app, raise_server_exceptions=False)


def _spy(monkeypatch):
    spy = AsyncMock(return_value=True)
    monkeypatch.setattr(billing, "set_plan_for_purchase", spy)
    return spy


def test_missing_secret_config_is_503(monkeypatch):
    monkeypatch.delenv("GUMROAD_WEBHOOK_SECRET", raising=False)
    res = _client().post("/api/billing/gumroad/webhook", data={"email": "a@b.com"})
    assert res.status_code == 503


def test_wrong_secret_is_403(monkeypatch):
    _spy(monkeypatch)
    res = _client().post(
        "/api/billing/gumroad/webhook?secret=nope", data={"email": "a@b.com"}
    )
    assert res.status_code == 403


def test_valid_sale_upgrades_to_pro(monkeypatch):
    spy = _spy(monkeypatch)
    res = _client().post(
        f"/api/billing/gumroad/webhook?secret={_SECRET}",
        data={"email": "buyer@example.com", "sale_id": "s1"},
    )
    assert res.status_code == 200
    assert res.json()["plan"] == "pro"
    spy.assert_awaited_once()
    args = spy.await_args.args
    assert args[1] == "buyer@example.com" and args[2] == "pro"


def test_secret_via_header(monkeypatch):
    spy = _spy(monkeypatch)
    res = _client().post(
        "/api/billing/gumroad/webhook",
        data={"email": "buyer@example.com"},
        headers={"X-Gumroad-Secret": _SECRET},
    )
    assert res.status_code == 200
    spy.assert_awaited_once()


def test_refund_downgrades_to_free(monkeypatch):
    spy = _spy(monkeypatch)
    res = _client().post(
        f"/api/billing/gumroad/webhook?secret={_SECRET}",
        data={"email": "buyer@example.com", "refunded": "true"},
    )
    assert res.status_code == 200
    assert res.json()["plan"] == "free"
    assert spy.await_args.args[2] == "free"


def test_cancellation_resource_downgrades(monkeypatch):
    spy = _spy(monkeypatch)
    res = _client().post(
        f"/api/billing/gumroad/webhook?secret={_SECRET}",
        data={"email": "buyer@example.com", "resource_name": "subscription_ended"},
    )
    assert res.status_code == 200
    assert spy.await_args.args[2] == "free"


def test_seller_mismatch_is_403(monkeypatch):
    monkeypatch.setenv("GUMROAD_SELLER_ID", "seller-123")
    _spy(monkeypatch)
    res = _client().post(
        f"/api/billing/gumroad/webhook?secret={_SECRET}",
        data={"email": "buyer@example.com", "seller_id": "someone-else"},
    )
    assert res.status_code == 403


def test_wrong_product_is_ignored_not_applied(monkeypatch):
    monkeypatch.setenv("GUMROAD_PRODUCT_ID", "prod-xyz")
    spy = _spy(monkeypatch)
    res = _client().post(
        f"/api/billing/gumroad/webhook?secret={_SECRET}",
        data={"email": "buyer@example.com", "product_id": "other-product"},
    )
    assert res.status_code == 200
    assert res.json().get("ignored") == "product"
    spy.assert_not_awaited()


def test_missing_email_is_acknowledged_without_change(monkeypatch):
    spy = _spy(monkeypatch)
    res = _client().post(
        f"/api/billing/gumroad/webhook?secret={_SECRET}", data={"sale_id": "s1"}
    )
    assert res.status_code == 200
    assert res.json().get("ignored") == "no-email"
    spy.assert_not_awaited()


# ---------------------------------------------------------------------------
# set_plan_for_purchase (entitlement layer, mock session)
# ---------------------------------------------------------------------------

class TestSetPlanForPurchase:
    def _session(self, found):
        s = MagicMock()
        r = MagicMock()
        r.scalar_one_or_none.return_value = found
        s.execute = AsyncMock(return_value=r)
        s.add = MagicMock()
        s.commit = AsyncMock()
        return s

    def test_updates_existing_user(self):
        from services.user_service import set_plan_for_purchase
        user = MagicMock()
        user.plan = "free"
        s = self._session(user)
        ok = asyncio.run(set_plan_for_purchase(s, "a@b.com", "pro"))
        assert ok is True and user.plan == "pro"
        assert s.commit.await_count == 1 and not s.add.called

    def test_preprovisions_when_absent_on_upgrade(self):
        from services.user_service import set_plan_for_purchase
        s = self._session(None)
        ok = asyncio.run(set_plan_for_purchase(s, "new@b.com", "pro"))
        assert ok is True and s.add.called and s.commit.await_count == 1

    def test_downgrade_unknown_email_is_noop(self):
        from services.user_service import set_plan_for_purchase
        s = self._session(None)
        ok = asyncio.run(set_plan_for_purchase(s, "x@b.com", "free"))
        assert ok is False and not s.add.called

    def test_empty_email_is_noop(self):
        from services.user_service import set_plan_for_purchase
        s = self._session(None)
        assert asyncio.run(set_plan_for_purchase(s, "", "pro")) is False
