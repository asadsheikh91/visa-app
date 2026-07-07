"""
country_sources.py

Module D: Trust / Sources layer — the single registry of *which official
authority* governs each destination's student-visa rules, the canonical guidance
URL, and when we last reviewed that guidance.

Pure data + lookup. No I/O. The frontend surfaces this as
"Guidance from <authority>, last reviewed <date>" so every rule on the site is
visibly traceable to a government source.

Keep `last_reviewed` honest: update it (ISO YYYY-MM-DD) whenever the linked
guidance is re-checked against the live source.
"""

COUNTRY_AUTHORITY: dict[str, dict] = {
    "uk": {
        "authority":    "UK Visas & Immigration (UKVI)",
        "official_url": "https://www.gov.uk/student-visa",
        "last_reviewed": "2025-01-15",
    },
    "usa": {
        "authority":    "U.S. Department of State — Bureau of Consular Affairs",
        "official_url": "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html",
        "last_reviewed": "2025-01-15",
    },
    "canada": {
        "authority":    "Immigration, Refugees and Citizenship Canada (IRCC)",
        "official_url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html",
        "last_reviewed": "2025-01-15",
    },
    "australia": {
        "authority":    "Australian Department of Home Affairs",
        "official_url": "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500",
        "last_reviewed": "2025-01-15",
    },
}


def get_country_meta(country: str) -> dict | None:
    """Return {country, authority, official_url, last_reviewed} or None if unknown."""
    country = (country or "").lower().strip()
    meta = COUNTRY_AUTHORITY.get(country)
    if meta is None:
        return None
    return {"country": country, **meta}


# ---------------------------------------------------------------------------
# Rule changelog (Module 2: Trust / Freshness)
# ---------------------------------------------------------------------------
# A hand-curated, dated record of material changes to each destination's
# student-visa rules. This is what makes "gov-sourced" verifiable: every change
# is dated and linked to the official source. Keep it honest and append-only —
# add a new entry when a rule changes; never back-date.
#
# Each entry: {date (ISO), area, summary, impact ("high"|"medium"|"low"), source_url}
# Newest entries may appear in any order here; the service sorts by date.

RULE_CHANGELOG: dict[str, list[dict]] = {
    "uk": [
        {
            "date": "2024-01-01",
            "area": "Dependants",
            "summary": "Most international students can no longer bring dependants on the Student route "
                       "(exceptions for postgraduate research and government-sponsored courses).",
            "impact": "high",
            "source_url": "https://www.gov.uk/government/publications/changes-to-the-immigration-rules",
        },
        {
            "date": "2024-01-02",
            "area": "Maintenance funds",
            "summary": "Maintenance (living cost) requirement is £1,483/month in London and £1,136/month "
                       "outside London, for up to 9 months.",
            "impact": "high",
            "source_url": "https://www.gov.uk/student-visa/money",
        },
    ],
    "canada": [
        {
            "date": "2024-01-01",
            "area": "Proof of funds",
            "summary": "IRCC raised the cost-of-living financial requirement for a single applicant to "
                       "CAD 20,635 (from the long-standing CAD 10,000).",
            "impact": "high",
            "source_url": "https://www.canada.ca/en/immigration-refugees-citizenship/news/2023/12/"
                          "international-students-to-benefit-from-modernized-system.html",
        },
    ],
    "australia": [
        {
            "date": "2024-05-10",
            "area": "Financial capacity",
            "summary": "Home Affairs increased the student visa financial capacity requirement to "
                       "AUD 29,710 for a single applicant.",
            "impact": "high",
            "source_url": "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500",
        },
    ],
    "usa": [
        # No material changes recorded yet. Freshness still reports the authority +
        # last-reviewed date; entries are appended here as rules change.
    ],
}


def get_changelog(country: str) -> list[dict] | None:
    """Return the changelog entries for a country (possibly empty), or None if unknown."""
    country = (country or "").lower().strip()
    if country not in COUNTRY_AUTHORITY:
        return None
    return list(RULE_CHANGELOG.get(country, []))
