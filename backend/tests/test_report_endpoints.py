"""
tests/test_report_endpoints.py

Access-control + flow tests for the Readiness Report endpoints (Definition-of-Done
#5) and the render-token capability, using FastAPI TestClient with dependency
overrides (no real DB, auth, browser, or R2).

Covers:
  POST /assessments/{id}/report — 403 unpaid, 404 unknown, 403 non-owner, 200 owner+paid
  GET  /reports/{token}         — 404 bad/foreign token, 403 plan lapsed, 200 owner+paid
  GET  /reports/{token}/pdf     — 404 foreign, 403 unpaid, 503 storage off, 200 signed URL
  GET  /reports/{token}/render  — 404 bad rt, 200 valid rt, single-use (2nd → 404)
  render_tokens                 — mint/consume, single-use, expiry, unknown
"""

import time
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from auth.base import AuthUser
from auth.dependencies import get_current_user
from database import get_db
from limiter import limiter
from routers import report as report_router
from services import render_tokens, report_cache


@pytest.fixture(autouse=True)
def _reset():
    render_tokens._reset_for_tests()
    report_cache._reset_for_tests()
    yield
    render_tokens._reset_for_tests()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _result(value):
    r = MagicMock()
    r.scalar_one_or_none.return_value = value
    return r


def _db_user(plan="pro"):
    u = MagicMock()
    u.id = uuid.uuid4()
    u.plan = plan
    return u


def _report(owner_id, token="tok-abc"):
    r = MagicMock()
    r.user_id = owner_id
    r.token = token
    r.report_id = "PV-CA-2026-0001"
    r.narrated_by_ai = True
    return r


def _client(session):
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(report_router.router, prefix="/api/visa")
    app.dependency_overrides[get_current_user] = lambda: AuthUser(user_id="u1", email="e@x.com")
    app.dependency_overrides[get_db] = lambda: session
    return TestClient(app, raise_server_exceptions=False)


def _patch_user(monkeypatch, db_user):
    monkeypatch.setattr(report_router, "get_user_by_auth_id", AsyncMock(return_value=db_user))


# ---------------------------------------------------------------------------
# POST /assessments/{id}/report
# ---------------------------------------------------------------------------

class TestCreateReport:
    @pytest.mark.skip(reason="TEMP free-access window (2026-07-08 → 2026-07-15): "
                             "paywall gate in routers/report.py is commented out. "
                             "Un-skip when the gate is re-enabled.")
    def test_unpaid_is_403(self, monkeypatch):
        _patch_user(monkeypatch, _db_user(plan="free"))
        session = MagicMock()
        session.execute = AsyncMock()
        res = _client(session).post(f"/api/visa/assessments/{uuid.uuid4()}/report")
        assert res.status_code == 403
        session.execute.assert_not_called()  # gated before any DB work

    def test_unknown_assessment_is_404(self, monkeypatch):
        _patch_user(monkeypatch, _db_user())
        session = MagicMock()
        session.execute = AsyncMock(side_effect=[_result(None)])
        res = _client(session).post(f"/api/visa/assessments/{uuid.uuid4()}/report")
        assert res.status_code == 404

    def test_non_owner_is_403(self, monkeypatch):
        db_user = _db_user()
        _patch_user(monkeypatch, db_user)
        foreign_check = MagicMock()
        foreign_check.user_id = uuid.uuid4()  # different owner
        session = MagicMock()
        session.execute = AsyncMock(side_effect=[_result(foreign_check)])
        res = _client(session).post(f"/api/visa/assessments/{uuid.uuid4()}/report")
        assert res.status_code == 403

    def test_owner_paid_is_200(self, monkeypatch):
        db_user = _db_user()
        _patch_user(monkeypatch, db_user)
        check = MagicMock()
        check.user_id = db_user.id
        session = MagicMock()
        # queries: check, existing-report-for-assessment (None → new), profile.
        # db_user is a paid plan, so the lifetime cap short-circuits without a count query.
        session.execute = AsyncMock(side_effect=[_result(check), _result(None), _result(None)])
        built = _report(db_user.id)
        monkeypatch.setattr(report_router, "build_report", AsyncMock(return_value=built))

        res = _client(session).post(f"/api/visa/assessments/{uuid.uuid4()}/report")
        assert res.status_code == 200
        body = res.json()
        assert body["token"] == built.token
        assert body["reportId"] == built.report_id
        assert body["narratedByAi"] is True


# ---------------------------------------------------------------------------
# GET /reports/{token}
# ---------------------------------------------------------------------------

class TestGetReport:
    def test_bad_token_is_404(self, monkeypatch):
        _patch_user(monkeypatch, _db_user())
        session = MagicMock()
        session.execute = AsyncMock(side_effect=[_result(None)])
        res = _client(session).get("/api/visa/reports/nope")
        assert res.status_code == 404

    def test_foreign_report_is_404_not_403(self, monkeypatch):
        _patch_user(monkeypatch, _db_user())
        session = MagicMock()
        session.execute = AsyncMock(side_effect=[_result(_report(uuid.uuid4()))])  # someone else's
        res = _client(session).get("/api/visa/reports/tok-abc")
        assert res.status_code == 404  # never a 403 oracle for a foreign token

    @pytest.mark.skip(reason="TEMP free-access window (2026-07-08 → 2026-07-15): "
                             "paywall gate in routers/report.py is commented out. "
                             "Un-skip when the gate is re-enabled.")
    def test_plan_lapsed_is_403(self, monkeypatch):
        db_user = _db_user(plan="free")
        _patch_user(monkeypatch, db_user)
        session = MagicMock()
        session.execute = AsyncMock(side_effect=[_result(_report(db_user.id))])
        res = _client(session).get("/api/visa/reports/tok-abc")
        assert res.status_code == 403

    def test_owner_paid_returns_data(self, monkeypatch):
        db_user = _db_user()
        _patch_user(monkeypatch, db_user)
        session = MagicMock()
        session.execute = AsyncMock(side_effect=[_result(_report(db_user.id))])
        monkeypatch.setattr(report_router, "decrypt_report_data",
                            lambda r: {"reportId": "PV-CA-2026-0001", "band": "Conditional"})
        res = _client(session).get("/api/visa/reports/tok-abc")
        assert res.status_code == 200
        assert res.json()["band"] == "Conditional"


# ---------------------------------------------------------------------------
# GET /reports/{token}/pdf
# ---------------------------------------------------------------------------

class TestGetReportPdf:
    def _wire_pdf(self, monkeypatch, url="https://r2.example/signed"):
        monkeypatch.setattr(report_router.report_storage, "is_configured", lambda: True)
        monkeypatch.setattr(report_router.report_pdf, "render_report_pdf", lambda u, **k: b"%PDF-1.4 fake")
        monkeypatch.setattr(report_router.report_storage, "upload_pdf", lambda key, data: None)
        monkeypatch.setattr(report_router.report_storage, "presigned_get_url", lambda key, ttl=300: url)

    def test_foreign_is_404(self, monkeypatch):
        _patch_user(monkeypatch, _db_user())
        session = MagicMock()
        session.execute = AsyncMock(side_effect=[_result(_report(uuid.uuid4()))])
        res = _client(session).get("/api/visa/reports/tok-abc/pdf")
        assert res.status_code == 404

    @pytest.mark.skip(reason="TEMP free-access window (2026-07-08 → 2026-07-15): "
                             "paywall gate in routers/report.py is commented out. "
                             "Un-skip when the gate is re-enabled.")
    def test_unpaid_is_403(self, monkeypatch):
        db_user = _db_user(plan="free")
        _patch_user(monkeypatch, db_user)
        session = MagicMock()
        session.execute = AsyncMock(side_effect=[_result(_report(db_user.id))])
        res = _client(session).get("/api/visa/reports/tok-abc/pdf")
        assert res.status_code == 403

    def test_storage_unconfigured_is_503(self, monkeypatch):
        db_user = _db_user()
        _patch_user(monkeypatch, db_user)
        session = MagicMock()
        session.execute = AsyncMock(side_effect=[_result(_report(db_user.id))])
        monkeypatch.setattr(report_router.report_storage, "is_configured", lambda: False)
        res = _client(session).get("/api/visa/reports/tok-abc/pdf")
        assert res.status_code == 503

    def test_owner_paid_returns_signed_url(self, monkeypatch):
        db_user = _db_user()
        _patch_user(monkeypatch, db_user)
        session = MagicMock()
        session.execute = AsyncMock(side_effect=[_result(_report(db_user.id))])
        self._wire_pdf(monkeypatch)
        res = _client(session).get("/api/visa/reports/tok-abc/pdf")
        assert res.status_code == 200
        body = res.json()
        assert body["url"] == "https://r2.example/signed"
        assert body["expiresAt"].endswith("Z")

    def test_render_failure_is_503(self, monkeypatch):
        db_user = _db_user()
        _patch_user(monkeypatch, db_user)
        session = MagicMock()
        session.execute = AsyncMock(side_effect=[_result(_report(db_user.id))])
        monkeypatch.setattr(report_router.report_storage, "is_configured", lambda: True)

        def _boom(u, **k):
            raise report_router.report_pdf.PdfRenderError("no chromium")

        monkeypatch.setattr(report_router.report_pdf, "render_report_pdf", _boom)
        res = _client(session).get("/api/visa/reports/tok-abc/pdf")
        assert res.status_code == 503


# ---------------------------------------------------------------------------
# GET /reports/{token}/render  (render-token gated, Clerk-free)
# ---------------------------------------------------------------------------

class TestRenderData:
    def test_bad_render_token_is_404(self):
        session = MagicMock()
        session.execute = AsyncMock()
        res = _client(session).get("/api/visa/reports/tok-abc/render?rt=bogus")
        assert res.status_code == 404
        session.execute.assert_not_called()

    def test_valid_render_token_returns_data(self, monkeypatch):
        session = MagicMock()
        session.execute = AsyncMock(side_effect=[_result(_report(uuid.uuid4(), token="tok-abc"))])
        monkeypatch.setattr(report_router, "decrypt_report_data",
                            lambda r: {"reportId": "PV-CA-2026-0001"})
        rt = render_tokens.mint("tok-abc")
        res = _client(session).get(f"/api/visa/reports/tok-abc/render?rt={rt}")
        assert res.status_code == 200
        assert res.json()["reportId"] == "PV-CA-2026-0001"

    def test_render_token_is_single_use(self, monkeypatch):
        monkeypatch.setattr(report_router, "decrypt_report_data", lambda r: {"ok": True})
        rt = render_tokens.mint("tok-abc")

        s1 = MagicMock()
        s1.execute = AsyncMock(side_effect=[_result(_report(uuid.uuid4(), token="tok-abc"))])
        assert _client(s1).get(f"/api/visa/reports/tok-abc/render?rt={rt}").status_code == 200

        s2 = MagicMock()
        s2.execute = AsyncMock()
        assert _client(s2).get(f"/api/visa/reports/tok-abc/render?rt={rt}").status_code == 404

    def test_render_token_bound_to_its_report(self, monkeypatch):
        # A token minted for tok-abc must not unlock a different report token.
        rt = render_tokens.mint("tok-abc")
        session = MagicMock()
        session.execute = AsyncMock()
        res = _client(session).get(f"/api/visa/reports/OTHER/render?rt={rt}")
        assert res.status_code == 404


# ---------------------------------------------------------------------------
# render_tokens unit
# ---------------------------------------------------------------------------

class TestRenderTokens:
    def test_mint_then_consume(self):
        rt = render_tokens.mint("tok-1")
        assert render_tokens.consume(rt) == "tok-1"

    def test_single_use(self):
        rt = render_tokens.mint("tok-1")
        assert render_tokens.consume(rt) == "tok-1"
        assert render_tokens.consume(rt) is None

    def test_unknown_token(self):
        assert render_tokens.consume("never-minted") is None

    def test_expired_token(self, monkeypatch):
        # Exercise the in-process fallback's expiry logic deterministically,
        # independent of whether a live Redis is configured in the environment.
        monkeypatch.setattr(report_cache, "_get_redis", lambda: None)
        rt = render_tokens.mint("tok-1")
        render_tokens._local[rt] = ("tok-1", time.time() - 1)  # force-expire
        assert render_tokens.consume(rt) is None

    def test_empty_token(self):
        assert render_tokens.consume("") is None
