"""
services/admin.py

Admin authorization: who is allowed into the operator panel.

Design: admins are identified by an env allowlist (ADMIN_EMAILS), matched against
the user's verified email (case-insensitive). No schema flag, nothing hardcoded in
code — rotate access by editing one env var. This is the ONLY source of truth for
"is this user an admin", used both by the admin router's dependency and by the
entitlements module (admins are exempt from usage caps).
"""

import os
from functools import lru_cache


def _parse_emails(raw: str | None) -> frozenset[str]:
    if not raw:
        return frozenset()
    return frozenset(
        part.strip().lower() for part in raw.split(",") if part.strip()
    )


def admin_emails() -> frozenset[str]:
    """
    The configured admin email allowlist (lowercased). Read live from the env so a
    deployment can change ADMIN_EMAILS without a code change; parsing is cheap.
    """
    return _parse_emails(os.getenv("ADMIN_EMAILS"))


def is_admin_email(email: str | None) -> bool:
    if not email:
        return False
    return email.strip().lower() in admin_emails()


def is_admin(user_or_email) -> bool:
    """
    True when the given user (any object with an `email` attribute) or raw email
    string is on the admin allowlist. Safe on None.
    """
    if user_or_email is None:
        return False
    if isinstance(user_or_email, str):
        return is_admin_email(user_or_email)
    return is_admin_email(getattr(user_or_email, "email", None))
