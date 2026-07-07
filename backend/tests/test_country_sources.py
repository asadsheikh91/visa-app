"""
tests/test_country_sources.py

Unit tests for the Trust/Sources country authority registry (Module D).
"""

import re

from services.country_sources import get_country_meta, COUNTRY_AUTHORITY


def test_all_supported_countries_have_meta():
    for country in ("uk", "usa", "canada", "australia"):
        meta = get_country_meta(country)
        assert meta is not None
        assert meta["country"] == country
        assert meta["authority"]
        assert meta["official_url"].startswith("https://")
        # last_reviewed is an ISO date
        assert re.match(r"^\d{4}-\d{2}-\d{2}$", meta["last_reviewed"])


def test_case_insensitive_and_trimmed():
    assert get_country_meta("  UK ") == get_country_meta("uk")


def test_unknown_country_returns_none():
    assert get_country_meta("narnia") is None
    assert get_country_meta("") is None


def test_registry_covers_only_known_countries():
    assert set(COUNTRY_AUTHORITY) == {"uk", "usa", "canada", "australia"}
