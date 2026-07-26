"""
tests/test_admin.py

Admin panel authorization + a control-plane write, using FastAPI TestClient with
dependency overrides. The allowlist (ADMIN_EMAILS) is the sole gate; a
non-allowlisted account must get 403 on every admin route.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from auth.base import AuthUser
from auth.dependencies import get_current_user
from database import get_db
from limiter import limiter
from routers import admin as admin_router


def _db_user(email):
    u = MagicMock()
    u.id = uuid.uuid4()
    u.email = email
    u.plan = "free"
    u.auth_user_id = "clerk_1"
    u.readiness_check_limit = None
    u.report_limit = None
    return u


def _client(email="user@example.com"):
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(admin_router.router, prefix="/api/admin")
    app.dependency_overrides[get_current_user] = lambda: AuthUser(user_id="clerk_1", email=email)
    app.dependency_overrides[get_db] = lambda: MagicMock()
    return TestClient(app, raise_server_exceptions=False)


class TestAdminAuth:
    def test_non_admin_is_403(self, monkeypatch):
        monkeypatch.setenv("ADMIN_EMAILS", "boss@example.com")
        with patch("auth.dependencies.get_user_by_auth_id",
                   AsyncMock(return_value=_db_user("user@example.com"))):
            res = _client("user@example.com").get("/api/admin/me")
        assert res.status_code == 403

    def test_admin_is_200(self, monkeypatch):
        monkeypatch.setenv("ADMIN_EMAILS", "boss@example.com")
        with patch("auth.dependencies.get_user_by_auth_id",
                   AsyncMock(return_value=_db_user("boss@example.com"))):
            res = _client("boss@example.com").get("/api/admin/me")
        assert res.status_code == 200
        assert res.json()["admin"] is True

    def test_no_allowlist_denies_everyone(self, monkeypatch):
        monkeypatch.delenv("ADMIN_EMAILS", raising=False)
        with patch("auth.dependencies.get_user_by_auth_id",
                   AsyncMock(return_value=_db_user("anyone@example.com"))):
            res = _client("anyone@example.com").get("/api/admin/overview")
        assert res.status_code == 403

    def test_allowlist_is_case_insensitive(self, monkeypatch):
        monkeypatch.setenv("ADMIN_EMAILS", "Boss@Example.com")
        with patch("auth.dependencies.get_user_by_auth_id",
                   AsyncMock(return_value=_db_user("boss@example.com"))):
            res = _client("boss@example.com").get("/api/admin/me")
        assert res.status_code == 200


class TestAdminUpdateUser:
    def test_patch_sets_plan_and_limits(self, monkeypatch):
        monkeypatch.setenv("ADMIN_EMAILS", "boss@example.com")
        target = _db_user("target@example.com")
        db = MagicMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        app = FastAPI()
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        app.include_router(admin_router.router, prefix="/api/admin")
        app.dependency_overrides[get_current_user] = lambda: AuthUser(user_id="clerk_1", email="boss@example.com")
        app.dependency_overrides[get_db] = lambda: db
        client = TestClient(app, raise_server_exceptions=False)

        with patch("auth.dependencies.get_user_by_auth_id",
                   AsyncMock(return_value=_db_user("boss@example.com"))), \
             patch("services.admin_service.get_user_by_id", AsyncMock(return_value=target)):
            res = client.patch(
                f"/api/admin/users/{target.id}",
                json={"plan": "pro", "readiness_check_limit": 10},
            )
        assert res.status_code == 200
        body = res.json()
        assert body["plan"] == "pro"
        assert body["readiness_check_limit"] == 10
        assert target.plan == "pro"
        assert target.readiness_check_limit == 10
