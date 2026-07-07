"""
notifications.py — a thin, gracefully-degrading outbound notification layer.

Shared by Module 2 (rule-change alerts) and Module 3 (outcome-report prompts).

Design mirrors ai_client.py: no provider configured → calls become safe no-ops
that log and return False, so features work in-app even before email is wired up.
To enable email later, set NOTIFY_EMAIL_PROVIDER + the provider's key and
implement _send_via_provider; nothing else changes.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    """True when an email/notification provider is configured."""
    return bool(os.getenv("NOTIFY_EMAIL_PROVIDER", "").strip())


def send_email(to: str, subject: str, body: str) -> bool:
    """
    Send a transactional email. Returns True if dispatched, False if skipped.

    Never raises — a notification failure must not break the request that
    triggered it. When no provider is configured this logs and returns False.
    """
    if not to:
        return False
    if not is_configured():
        logger.info("notifications: provider not configured; skipping email to %s (%r)", to, subject)
        return False
    try:
        return _send_via_provider(to, subject, body)
    except Exception:
        logger.exception("notifications: failed to send email to %s", to)
        return False


def _send_via_provider(to: str, subject: str, body: str) -> bool:  # pragma: no cover - needs provider
    """
    Provider integration point. Implement for the chosen provider (Resend/SES/etc.)
    keyed off NOTIFY_EMAIL_PROVIDER. Left unimplemented on purpose so the feature
    ships degraded-but-safe.
    """
    provider = os.getenv("NOTIFY_EMAIL_PROVIDER", "").strip().lower()
    logger.warning("notifications: provider %r is set but no integration is implemented yet.", provider)
    return False
