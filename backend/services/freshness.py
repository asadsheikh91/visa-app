"""
freshness.py — Module 2: Trust / Freshness.

Turns the static source registry (country_sources) into a live trust signal:
  - how long ago each destination's guidance was last reviewed, as a status
    (fresh / aging / stale), so stale rules are *visible* rather than silently
    trusted;
  - the dated, source-linked changelog of rule changes;
  - which changelog entries are "new" to a given user (for in-app alerts).

Pure functions — no I/O, no DB. The router owns persistence of per-user
last-seen state and any outbound notification.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from services.country_sources import (
    COUNTRY_AUTHORITY, get_country_meta, get_changelog,
)

# Day thresholds for the freshness status.
FRESH_MAX_DAYS = 30     # reviewed within a month → fresh
AGING_MAX_DAYS = 90     # within a quarter → aging; older → stale

STATUS_FRESH = "fresh"
STATUS_AGING = "aging"
STATUS_STALE = "stale"


def _parse_iso(d: str) -> Optional[date]:
    try:
        return datetime.strptime(d.strip()[:10], "%Y-%m-%d").date()
    except (ValueError, AttributeError):
        return None


def freshness_status(last_reviewed: str, today: Optional[date] = None) -> dict:
    """
    Map a last-reviewed ISO date to {last_reviewed, days_ago, status}.

    A missing/unparseable date is treated as stale with days_ago=None, so the UI
    always renders a truthful badge rather than crashing.
    """
    today = today or date.today()
    reviewed = _parse_iso(last_reviewed or "")
    if reviewed is None:
        return {"last_reviewed": last_reviewed, "days_ago": None, "status": STATUS_STALE}

    days_ago = (today - reviewed).days
    if days_ago <= FRESH_MAX_DAYS:
        status = STATUS_FRESH
    elif days_ago <= AGING_MAX_DAYS:
        status = STATUS_AGING
    else:
        status = STATUS_STALE
    return {"last_reviewed": last_reviewed, "days_ago": days_ago, "status": status}


def country_freshness(country: str, today: Optional[date] = None) -> Optional[dict]:
    """Freshness for one country: authority + url + last_reviewed + status, or None."""
    meta = get_country_meta(country)
    if meta is None:
        return None
    fs = freshness_status(meta["last_reviewed"], today)
    changelog = get_changelog(country) or []
    return {
        "country": meta["country"],
        "authority": meta["authority"],
        "official_url": meta["official_url"],
        **fs,
        "change_count": len(changelog),
        "latest_change": _latest_change_date(changelog),
    }


def all_freshness(today: Optional[date] = None) -> list[dict]:
    """Freshness for every supported country, ordered most-stale first."""
    out = [country_freshness(c, today) for c in COUNTRY_AUTHORITY]
    out = [o for o in out if o]
    # Most stale (largest days_ago) first; None days_ago sorts as most stale.
    out.sort(key=lambda o: (o["days_ago"] is not None, -(o["days_ago"] or 0)))
    return out


def _latest_change_date(changelog: list[dict]) -> Optional[str]:
    dates = [c.get("date") for c in changelog if c.get("date")]
    return max(dates) if dates else None


def sorted_changelog(country: str) -> Optional[list[dict]]:
    """Changelog for a country, newest first. None if the country is unknown."""
    entries = get_changelog(country)
    if entries is None:
        return None
    return sorted(entries, key=lambda e: e.get("date", ""), reverse=True)


def updates_since(country: str, since: Optional[str]) -> list[dict]:
    """
    Changelog entries strictly newer than `since` (ISO date), newest first.

    `since` None/empty → all entries are considered new (first visit).
    """
    entries = sorted_changelog(country) or []
    since_d = _parse_iso(since) if since else None
    if since_d is None:
        return entries
    out = []
    for e in entries:
        ed = _parse_iso(e.get("date", ""))
        if ed and ed > since_d:
            out.append(e)
    return out
