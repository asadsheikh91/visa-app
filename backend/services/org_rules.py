"""
org_rules.py — Module 5 pure rules: roles, seats, email normalization,
client-status transitions. No DB, no I/O.
"""

from __future__ import annotations

ROLES = ("owner", "consultant", "admin")
CLIENT_STATUSES = ("invited", "active", "declined", "removed")

# Client-roster seat limits by org plan. "team" is the default free tier.
ORG_CLIENT_LIMITS: dict[str, int] = {
    "team": 5,
    "pro": 200,
}
_DEFAULT_CLIENT_LIMIT = 5


def normalize_email(email: str | None) -> str:
    """Lowercase + trim — the canonical form we match invitations against."""
    return (email or "").strip().lower()


def is_valid_role(role: str | None) -> bool:
    return (role or "") in ROLES


def can_manage_clients(role: str | None) -> bool:
    """Owners, consultants and admins may invite/remove clients."""
    return role in ("owner", "consultant", "admin")


def client_limit_for_plan(plan: str | None) -> int:
    return ORG_CLIENT_LIMITS.get((plan or "").strip().lower(), _DEFAULT_CLIENT_LIMIT)


def is_seat_available(active_or_invited_count: int, plan: str | None) -> bool:
    """A seat is consumed by each non-terminal (invited/active) client."""
    return active_or_invited_count < client_limit_for_plan(plan)


def can_view_client(client_status: str | None) -> bool:
    """Consent gate: a consultant may view a client's data only once active."""
    return client_status == "active"
