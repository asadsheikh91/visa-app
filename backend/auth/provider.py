"""
auth/provider.py

Reads AUTH_PROVIDER from environment and returns the correct AuthProvider instance.
"""

import os

from auth.base import AuthProvider

_provider: AuthProvider | None = None


def get_auth_provider() -> AuthProvider:
    """
    Returns a singleton AuthProvider instance.
    The provider is determined by the AUTH_PROVIDER environment variable.
    Defaults to 'clerk' if not set.
    """
    global _provider
    if _provider is not None:
        return _provider

    provider_name = os.environ.get("AUTH_PROVIDER", "clerk").lower()

    if provider_name == "clerk":
        from auth.clerk import ClerkAuthProvider
        _provider = ClerkAuthProvider()
    else:
        raise ValueError(
            f"Unknown AUTH_PROVIDER: '{provider_name}'. "
            f"Supported values: 'clerk'"
        )

    return _provider


def reset_provider() -> None:
    """Resets the cached provider instance. Useful in tests."""
    global _provider
    _provider = None
