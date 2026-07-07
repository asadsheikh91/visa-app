"""
tests/test_clerk_auth.py

Verifies the hardened Clerk JWT verification (issuer pinning + opt-in audience).
Uses a real RSA keypair and real RS256 tokens; only the JWKS *key lookup* is
stubbed (so no network), exercising the real jwt.decode path in verify_token.
"""

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from auth.base import AuthError

JWKS_URL = "https://test-clerk.example.com/.well-known/jwks.json"
ISSUER = "https://test-clerk.example.com"


@pytest.fixture
def keypair():
    priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return priv, priv.public_key()


class _StubKey:
    def __init__(self, key):
        self.key = key


def _make_provider(monkeypatch, public_key, *, audience=None, issuer_env=None):
    monkeypatch.setenv("CLERK_JWKS_URL", JWKS_URL)
    if audience:
        monkeypatch.setenv("CLERK_AUDIENCE", audience)
    else:
        monkeypatch.delenv("CLERK_AUDIENCE", raising=False)
    if issuer_env:
        monkeypatch.setenv("CLERK_ISSUER", issuer_env)
    else:
        monkeypatch.delenv("CLERK_ISSUER", raising=False)
    from auth.clerk import ClerkAuthProvider
    prov = ClerkAuthProvider()  # PyJWKClient does not fetch until used
    monkeypatch.setattr(
        prov._jwks_client, "get_signing_key_from_jwt", lambda token: _StubKey(public_key)
    )
    return prov


def _token(priv, *, iss=ISSUER, sub="user_123", exp_delta=3600, aud=None, omit=()):
    now = int(time.time())
    payload = {"sub": sub, "iat": now, "exp": now + exp_delta}
    if iss is not None:
        payload["iss"] = iss
    if aud is not None:
        payload["aud"] = aud
    for k in omit:
        payload.pop(k, None)
    return jwt.encode(payload, priv, algorithm="RS256")


# ── issuer pinning ────────────────────────────────────────────────────────────

def test_issuer_is_derived_from_jwks_url(monkeypatch, keypair):
    prov = _make_provider(monkeypatch, keypair[1])
    assert prov._issuer == ISSUER


def test_valid_token_accepted(monkeypatch, keypair):
    priv, pub = keypair
    prov = _make_provider(monkeypatch, pub)
    user = prov.verify_token(_token(priv))
    assert user.user_id == "user_123"


def test_wrong_issuer_rejected(monkeypatch, keypair):
    priv, pub = keypair
    prov = _make_provider(monkeypatch, pub)
    with pytest.raises(AuthError) as ei:
        prov.verify_token(_token(priv, iss="https://evil-clerk.example.com"))
    assert "issuer" in str(ei.value).lower()


def test_missing_issuer_rejected(monkeypatch, keypair):
    priv, pub = keypair
    prov = _make_provider(monkeypatch, pub)
    with pytest.raises(AuthError):
        prov.verify_token(_token(priv, iss=None))


def test_explicit_issuer_override(monkeypatch, keypair):
    priv, pub = keypair
    custom = "https://clerk.myproddomain.com"
    prov = _make_provider(monkeypatch, pub, issuer_env=custom)
    assert prov._issuer == custom
    user = prov.verify_token(_token(priv, iss=custom))
    assert user.user_id == "user_123"


# ── expiry / required claims ─────────────────────────────────────────────────

def test_expired_token_rejected(monkeypatch, keypair):
    priv, pub = keypair
    prov = _make_provider(monkeypatch, pub)
    with pytest.raises(AuthError) as ei:
        prov.verify_token(_token(priv, exp_delta=-10))
    assert "expired" in str(ei.value).lower()


def test_missing_subject_rejected(monkeypatch, keypair):
    priv, pub = keypair
    prov = _make_provider(monkeypatch, pub)
    with pytest.raises(AuthError):
        prov.verify_token(_token(priv, omit=("sub",)))


def test_signature_from_other_key_rejected(monkeypatch, keypair):
    _, pub = keypair
    attacker = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    prov = _make_provider(monkeypatch, pub)  # server trusts `pub`
    with pytest.raises(AuthError):
        prov.verify_token(_token(attacker))   # but token signed by a different key


# ── audience: opt-in ──────────────────────────────────────────────────────────

def test_no_audience_configured_token_without_aud_ok(monkeypatch, keypair):
    # Default Clerk case: no CLERK_AUDIENCE set, token has no aud -> accepted.
    priv, pub = keypair
    prov = _make_provider(monkeypatch, pub, audience=None)
    assert prov._audience is None
    user = prov.verify_token(_token(priv, aud=None))
    assert user.user_id == "user_123"


def test_audience_configured_correct_aud_ok(monkeypatch, keypair):
    priv, pub = keypair
    prov = _make_provider(monkeypatch, pub, audience="parchivisa-api")
    user = prov.verify_token(_token(priv, aud="parchivisa-api"))
    assert user.user_id == "user_123"


def test_audience_configured_wrong_aud_rejected(monkeypatch, keypair):
    priv, pub = keypair
    prov = _make_provider(monkeypatch, pub, audience="parchivisa-api")
    with pytest.raises(AuthError):
        prov.verify_token(_token(priv, aud="some-other-app"))


def test_audience_configured_missing_aud_rejected(monkeypatch, keypair):
    priv, pub = keypair
    prov = _make_provider(monkeypatch, pub, audience="parchivisa-api")
    with pytest.raises(AuthError):
        prov.verify_token(_token(priv, aud=None))
