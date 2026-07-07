"""
tests/test_financial_document_router.py

Integration regression test for routers/financial_document.py.

WHY THIS EXISTS: the encryption *module* round-trip can pass while the *router*
still writes plaintext (e.g. encrypt_json never called, result discarded, a
silent try/except fallback, or a flag gate). A unit test of encryption alone
cannot catch that. This test exercises the real /evaluate route end-to-end and
asserts the exact object that reaches UserDocument.extracted is a Fernet
envelope — never the raw applicant PII. It FAILS if the router stores plaintext.

To keep it deterministic and DB-free (the rest of the suite uses a dummy
DATABASE_URL), the DB session is a fake that captures whatever the router hands
to session.add(); that captured value is exactly what SQLAlchemy would bind to
the column.
"""

import os
import uuid

import pytest
from cryptography.fernet import Fernet
from fastapi import FastAPI
from fastapi.testclient import TestClient

from limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from routers import financial_document as fd
from auth.dependencies import get_current_user
from auth.base import AuthUser
from database import get_db
from services.encryption import decrypt_json, is_envelope


_PAYLOAD = {
    "statement": {
        "bank_name": "domain.com BANK",
        "account_holder": "Asad Test",
        "currency": "GBP",
        "period_start": "2026-01-01",
        "period_end": "2026-02-28",
        "opening_balance": 20000.0,
        "closing_balance": 21000.0,
        "transactions": [{"date": "2026-01-01", "balance": 20000.0}],
    },
    "context": {"applicant_name": "Asad Test", "required_amount": 18000.0},
    "country": "uk",
}


class _FakeUser:
    def __init__(self):
        self.id = uuid.uuid4()
        self.plan = "free"


class _FakeSession:
    """Captures rows added; no-ops commit/refresh so no real DB is touched."""

    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        pass

    async def refresh(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()

    async def rollback(self):
        pass

    async def close(self):
        pass


@pytest.fixture
def patched_router(monkeypatch):
    """Stub out user resolution, quota, and the rule engine so the test isolates
    the persistence/encryption behaviour of the route."""

    async def fake_resolve(db, current_user):
        return _FakeUser()

    async def fake_quota(db, user, feature, model):
        return True, 5

    def fake_eval(statement, context, country):
        return {"overall_status": "pass"}

    monkeypatch.setattr(fd, "_resolve_db_user", fake_resolve)
    monkeypatch.setattr(fd, "check_quota", fake_quota)
    monkeypatch.setattr(fd, "evaluate_financial_document", fake_eval)


def _make_client(session):
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(fd.router, prefix="/api/visa/documents/financial")
    app.dependency_overrides[get_current_user] = lambda: AuthUser(user_id="t", email=None)

    async def _fake_db():
        yield session

    app.dependency_overrides[get_db] = _fake_db
    return TestClient(app, raise_server_exceptions=False)


def test_extracted_is_encrypted_at_rest(patched_router, monkeypatch):
    monkeypatch.setenv("FIELD_ENCRYPTION_KEY", Fernet.generate_key().decode())
    session = _FakeSession()
    client = _make_client(session)

    resp = client.post("/api/visa/documents/financial/evaluate", json=_PAYLOAD)
    assert resp.status_code == 200, resp.text

    assert len(session.added) == 1, "exactly one UserDocument row should be persisted"
    stored = session.added[0].extracted

    # THE INVARIANT THAT WAS VIOLATED IN PRODUCTION:
    # what reaches the column must be a Fernet envelope, not applicant PII.
    assert is_envelope(stored), f"extracted is not encrypted at rest: {stored!r}"
    assert stored.get("enc") == "fernet" and "ciphertext" in stored
    # No plaintext PII keys present in the stored value.
    for pii_key in ("bank_name", "account_holder", "transactions"):
        assert pii_key not in stored
    # ...and it round-trips back to the original applicant data.
    back = decrypt_json(stored)
    assert back["bank_name"] == "domain.com BANK"
    assert back["account_holder"] == "Asad Test"


def test_missing_key_fails_closed_and_writes_nothing(patched_router, monkeypatch):
    monkeypatch.delenv("FIELD_ENCRYPTION_KEY", raising=False)
    session = _FakeSession()
    client = _make_client(session)

    resp = client.post("/api/visa/documents/financial/evaluate", json=_PAYLOAD)
    # Fail closed: no key -> 503, and absolutely no row written (no plaintext fallback).
    assert resp.status_code == 503, resp.text
    assert session.added == [], "no row may be persisted when encryption is unavailable"
