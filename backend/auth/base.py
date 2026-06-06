"""
auth/base.py

The contract that every auth provider must satisfy.
The rest of the application imports ONLY from this file — never from clerk.py directly.
Swapping providers = writing a new implementation of AuthProvider, nothing else.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class AuthUser:
    """Normalised user object returned by any auth provider."""
    user_id: str
    email: str | None = None


class AuthError(Exception):
    """Raised by any AuthProvider when a token is invalid or expired."""
    pass


class AuthProvider(ABC):
    """
    Abstract auth provider interface.

    To swap from Clerk to anything else:
      1. Create a new file e.g. auth/auth0.py
      2. Subclass AuthProvider and implement verify_token()
      3. Set AUTH_PROVIDER=auth0 in your .env
      4. Register it in auth/provider.py
      Done. No route code changes required.
    """

    @abstractmethod
    def verify_token(self, token: str) -> AuthUser:
        """
        Verify a bearer token and return the authenticated user.
        Raise AuthError if the token is missing, invalid, or expired.
        """
        pass

    def fetch_email(self, user_id: str) -> str | None:
        """
        Optional: resolve a user's email when it is not present in the token
        claims (e.g. the default Clerk session token omits email).
        Best-effort only — implementations must never raise. Default: no-op.
        """
        return None
