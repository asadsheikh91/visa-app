"""
auth/clerk.py

Clerk implementation of AuthProvider.
Uses Clerk's JWKS endpoint to verify RS256 JWTs issued by Clerk.

To find your JWKS URL:
  Clerk Dashboard → API Keys → Advanced → JWKS URL
  It looks like: https://<your-clerk-domain>.clerk.accounts.dev/.well-known/jwks.json

This file is the ONLY place Clerk-specific logic lives.
Nothing outside this file should know Clerk exists.
"""

import json
import os
import time
import urllib.parse
import urllib.request

import jwt
from jwt import PyJWKClient

from auth.base import AuthError, AuthProvider, AuthUser

_CLERK_API_BASE = "https://api.clerk.com/v1"
# Small TTL cache so we hit Clerk's API at most once per user per hour.
_EMAIL_CACHE: dict[str, tuple[str | None, float]] = {}
_EMAIL_CACHE_TTL = 3600.0


class ClerkAuthProvider(AuthProvider):

    def __init__(self) -> None:
        jwks_url = os.environ.get("CLERK_JWKS_URL")
        if not jwks_url:
            raise RuntimeError(
                "CLERK_JWKS_URL is not set. "
                "Add it to your .env file. "
                "Find it in Clerk Dashboard → API Keys → Advanced → JWKS URL."
            )
        # PyJWKClient fetches and caches the public keys automatically.
        # Keys are refreshed when a new kid (key ID) is encountered.
        self._jwks_client = PyJWKClient(jwks_url, cache_keys=True)

    def verify_token(self, token: str) -> AuthUser:
        try:
            signing_key = self._jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                options={"verify_aud": False},  # Clerk does not always set aud
            )
        except jwt.ExpiredSignatureError:
            raise AuthError("Token has expired.")
        except jwt.InvalidTokenError as exc:
            raise AuthError(f"Invalid token: {exc}")
        except Exception as exc:
            raise AuthError(f"Authentication failed: {exc}")

        user_id = payload.get("sub")
        if not user_id:
            raise AuthError("Token is missing subject claim.")

        # The default Clerk session token does NOT include email. If a custom
        # session-token claim adds it, use it; otherwise fetch_email() fills it in.
        return AuthUser(
            user_id=user_id,
            email=payload.get("email"),
        )

    def fetch_email(self, user_id: str) -> str | None:
        """
        Best-effort email lookup via Clerk's Backend API. Requires CLERK_SECRET_KEY.
        Never raises — any failure returns None so authentication is unaffected.
        """
        secret = os.environ.get("CLERK_SECRET_KEY")
        if not secret or not user_id:
            return None

        cached = _EMAIL_CACHE.get(user_id)
        if cached is not None and time.monotonic() < cached[1]:
            return cached[0]

        email: str | None = None
        try:
            req = urllib.request.Request(
                f"{_CLERK_API_BASE}/users/{urllib.parse.quote(user_id)}",
                headers={"Authorization": f"Bearer {secret}"},
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            primary_id = data.get("primary_email_address_id")
            addresses = data.get("email_addresses") or []
            for addr in addresses:
                if addr.get("id") == primary_id:
                    email = addr.get("email_address")
                    break
            if email is None and addresses:
                email = addresses[0].get("email_address")
        except Exception:
            email = None

        _EMAIL_CACHE[user_id] = (email, time.monotonic() + _EMAIL_CACHE_TTL)
        return email
