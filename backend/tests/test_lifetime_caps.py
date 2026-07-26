"""
tests/test_lifetime_caps.py

Unit + router tests for the lifetime usage caps (3 readiness checks, 3 reports per
free account; paid/admin exempt; per-user overrides).

  services.entitlements.lifetime_limit_for  — resolution of the effective cap
  services.entitlements.check_lifetime_cap   — allow/deny vs all-time usage
  routers/student_visa  /start + /check       — 429 when over cap
"""

import asyncio
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
from models import Report, VisaCheck
from routers import student_visa
from services import entitlements


def _user(plan="free", email="u@example.com", check_limit=None, report_limit=None):
    u = MagicMock()
    u.id = uuid.uuid4()
    u.plan = plan
    u.email = email
    u.readiness_check_limit = check_limit
    u.report_limit = report_limit
    return u


def _count_db(count):
    """Mock async session whose execute(...).scalar_one() returns `count`."""
    db = MagicMock()
    result = MagicMock()
    result.scalar_one.return_value = count
    db.execute = AsyncMock(return_value=result)
    return db


# ---------------------------------------------------------------------------
# lifetime_limit_for
# ---------------------------------------------------------------------------

class TestLifetimeLimitFor:
    def test_free_defaults(self):
        u = _user(plan="free")
        assert entitlements.lifetime_limit_for(u, "readiness_check") == 3
        assert entitlements.lifetime_limit_for(u, "report") == 3

    def test_paid_is_unlimited(self):
        u = _user(plan="pro")
        assert entitlements.lifetime_limit_for(u, "readiness_check") is None
        assert entitlements.lifetime_limit_for(u, "report") is None

    def test_admin_is_unlimited(self, monkeypatch):
        monkeypatch.setenv("ADMIN_EMAILS", "boss@example.com")
        u = _user(plan="free", email="boss@example.com")
        assert entitlements.lifetime_limit_for(u, "readiness_check") is None

    def test_override_column_wins(self):
        u = _user(plan="free", check_limit=7)
        assert entitlements.lifetime_limit_for(u, "readiness_check") == 7
        # report cap untouched → default
        assert entitlements.lifetime_limit_for(u, "report") == 3

    def test_zero_override_blocks(self):
        u = _user(plan="free", report_limit=0)
        assert entitlements.lifetime_limit_for(u, "report") == 0


# ---------------------------------------------------------------------------
# check_lifetime_cap
# ---------------------------------------------------------------------------

class TestCheckLifetimeCap:
    def test_under_limit_allowed(self):
        u = _user(plan="free")
        allowed, used, limit = asyncio.run(entitlements.check_lifetime_cap(
            _count_db(2), u, "readiness_check", VisaCheck
        ))
        assert allowed is True and used == 2 and limit == 3

    def test_at_limit_denied(self):
        u = _user(plan="free")
        allowed, used, limit = asyncio.run(entitlements.check_lifetime_cap(
            _count_db(3), u, "readiness_check", VisaCheck
        ))
        assert allowed is False and used == 3 and limit == 3

    def test_paid_always_allowed(self):
        u = _user(plan="pro")
        allowed, used, limit = asyncio.run(entitlements.check_lifetime_cap(
            _count_db(99), u, "report", Report
        ))
        assert allowed is True and limit is None


# ---------------------------------------------------------------------------
# Router: /start + /check enforce the cap (429)
# ---------------------------------------------------------------------------

def _client():
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(student_visa.router, prefix="/api/visa/student")
    app.dependency_overrides[get_current_user] = lambda: AuthUser(user_id="u1", email="e@x.com")
    app.dependency_overrides[get_db] = lambda: MagicMock()
    return TestClient(app, raise_server_exceptions=False)


class TestRouterCap:
    def test_start_over_cap_is_429(self):
        with patch("routers.student_visa.get_user_by_auth_id", AsyncMock(return_value=_user())), \
             patch("routers.student_visa.check_lifetime_cap", AsyncMock(return_value=(False, 3, 3))), \
             patch("routers.student_visa.start_readiness_session", AsyncMock()) as start_mock:
            res = _client().post("/api/visa/student/australia/start")
        assert res.status_code == 429
        start_mock.assert_not_called()  # session never opened when over cap

    def test_start_under_cap_returns_session(self):
        session = MagicMock()
        session.id = uuid.uuid4()
        with patch("routers.student_visa.get_user_by_auth_id", AsyncMock(return_value=_user())), \
             patch("routers.student_visa.check_lifetime_cap", AsyncMock(return_value=(True, 1, 3))), \
             patch("routers.student_visa.start_readiness_session", AsyncMock(return_value=session)):
            res = _client().post("/api/visa/student/australia/start")
        assert res.status_code == 200
        body = res.json()
        assert body["session_id"] == str(session.id)
        assert body["remaining"] == 2

    def test_check_over_cap_is_429(self):
        clean = {
            "score": 90, "result": "Strong", "result_description": "ok",
            "critical_blockers": [], "high_risk_flags": [], "soft_warnings": [],
            "warnings": [], "recommendations": [], "normalized_answers": {}, "sources_used": [],
        }
        with patch("routers.student_visa.load_questions", return_value=[{"id": "q1", "required": False}]), \
             patch("routers.student_visa.load_scoring", return_value={"score_bands": []}), \
             patch("routers.student_visa.evaluate", return_value=clean), \
             patch("routers.student_visa.normalize_questions", return_value=[]), \
             patch("routers.student_visa.compute_required_missing", return_value=[]), \
             patch("routers.student_visa.get_user_by_auth_id", AsyncMock(return_value=_user())), \
             patch("routers.student_visa.check_lifetime_cap", AsyncMock(return_value=(False, 3, 3))), \
             patch("routers.student_visa.save_visa_check", AsyncMock()) as save_mock:
            res = _client().post("/api/visa/student/australia/check", json={"answers": {"q1": "yes"}})
        assert res.status_code == 429
        save_mock.assert_not_called()  # never saved when over cap
