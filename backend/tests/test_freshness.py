"""
tests/test_freshness.py

Module 2 freshness service. Pure functions — no DB, no I/O.
"""

from datetime import date

from services.freshness import (
    freshness_status, country_freshness, all_freshness,
    sorted_changelog, updates_since,
    STATUS_FRESH, STATUS_AGING, STATUS_STALE,
)
from services.country_sources import COUNTRY_AUTHORITY


# ── freshness_status ─────────────────────────────────────────────────────────

def test_status_fresh_aging_stale():
    today = date(2026, 6, 24)
    assert freshness_status("2026-06-10", today)["status"] == STATUS_FRESH
    assert freshness_status("2026-05-01", today)["status"] == STATUS_AGING
    assert freshness_status("2025-01-15", today)["status"] == STATUS_STALE


def test_status_days_ago_computed():
    today = date(2026, 6, 24)
    assert freshness_status("2026-06-14", today)["days_ago"] == 10


def test_status_unparseable_is_stale():
    fs = freshness_status("not-a-date")
    assert fs["status"] == STATUS_STALE
    assert fs["days_ago"] is None


# ── country_freshness / all_freshness ────────────────────────────────────────

def test_country_freshness_shape():
    fs = country_freshness("uk", date(2026, 6, 24))
    assert fs is not None
    assert fs["country"] == "uk"
    assert fs["authority"]
    assert fs["official_url"].startswith("https://")
    assert "status" in fs and "days_ago" in fs
    assert fs["change_count"] >= 1            # UK has changelog entries
    assert fs["latest_change"]                 # ISO date string


def test_country_freshness_unknown():
    assert country_freshness("narnia") is None


def test_all_freshness_covers_all_and_sorted_most_stale_first():
    out = all_freshness(date(2026, 6, 24))
    assert {o["country"] for o in out} == set(COUNTRY_AUTHORITY)
    days = [o["days_ago"] or 0 for o in out]
    assert days == sorted(days, reverse=True)


# ── changelog ────────────────────────────────────────────────────────────────

def test_sorted_changelog_newest_first():
    log = sorted_changelog("uk")
    assert log is not None and len(log) >= 2
    dates = [e["date"] for e in log]
    assert dates == sorted(dates, reverse=True)
    for e in log:
        assert e["source_url"].startswith("https://")
        assert e["impact"] in ("high", "medium", "low")


def test_sorted_changelog_unknown_country_none():
    assert sorted_changelog("narnia") is None


def test_changelog_empty_country_ok():
    # USA has an empty changelog but is a known country.
    assert sorted_changelog("usa") == []


# ── updates_since ────────────────────────────────────────────────────────────

def test_updates_since_none_returns_all():
    all_uk = sorted_changelog("uk")
    assert updates_since("uk", None) == all_uk


def test_updates_since_filters_strictly_newer():
    # UK entries are dated 2024-01-01 and 2024-01-02.
    after_first = updates_since("uk", "2024-01-01")
    assert all(e["date"] > "2024-01-01" for e in after_first)
    assert len(after_first) == 1


def test_updates_since_caught_up_returns_empty():
    assert updates_since("uk", "2030-01-01") == []
