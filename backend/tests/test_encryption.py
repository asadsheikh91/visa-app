"""
tests/test_encryption.py

Unit tests for services/encryption.py — the application-layer encryption used for
UserDocument.extracted (bank-statement PII). These exercise the module in
isolation (no DB). NOTE: passing these alone does NOT prove the router actually
encrypts before writing — that gap is covered by tests/test_financial_document_router.py.
"""

import os

import pytest
from cryptography.fernet import Fernet

from services import encryption
from services.encryption import (
    encrypt_json,
    decrypt_json,
    is_envelope,
    EncryptionUnavailableError,
    DecryptionError,
)


@pytest.fixture
def with_key(monkeypatch):
    monkeypatch.setenv("FIELD_ENCRYPTION_KEY", Fernet.generate_key().decode())
    yield


def test_round_trip(with_key):
    data = {
        "bank_name": "domain.com BANK",
        "account_holder": "Asad Test",
        "transactions": [{"date": "2026-01-01", "balance": 5000.0}],
    }
    env = encrypt_json(data)
    assert decrypt_json(env) == data


def test_envelope_shape_and_no_plaintext(with_key):
    env = encrypt_json({"bank_name": "SECRET BANK", "account_holder": "PII NAME"})
    assert is_envelope(env)
    assert env["enc"] == "fernet" and env["v"] == 1
    assert isinstance(env["ciphertext"], str)
    # The PII must not be recoverable by scanning the stored bytes.
    blob = str(env)
    assert "SECRET BANK" not in blob
    assert "PII NAME" not in blob


def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("FIELD_ENCRYPTION_KEY", raising=False)
    with pytest.raises(EncryptionUnavailableError):
        encrypt_json({"x": 1})


def test_invalid_key_raises(monkeypatch):
    monkeypatch.setenv("FIELD_ENCRYPTION_KEY", "not-a-valid-fernet-key")
    with pytest.raises(EncryptionUnavailableError):
        encrypt_json({"x": 1})


def test_decrypt_legacy_plaintext_passthrough(with_key):
    # Legacy rows (written before encryption) are plain dicts; decrypt_json must
    # return them unchanged rather than raise. is_envelope() must say False.
    legacy = {"bank_name": "OLD BANK", "balance": 1000}
    assert not is_envelope(legacy)
    assert decrypt_json(legacy) == legacy
    assert decrypt_json(None) is None


def test_tampered_ciphertext_raises(with_key):
    env = encrypt_json({"x": 1})
    env["ciphertext"] = env["ciphertext"][:-4] + "AAAA"  # corrupt the token
    with pytest.raises(DecryptionError):
        decrypt_json(env)
