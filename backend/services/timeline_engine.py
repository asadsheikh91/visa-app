"""
timeline_engine.py

Module C: Timeline & Deadline Planner engine.

Pure function — no DB, no I/O. The router/service owns persistence.
(Same contract as services/financial_proof_engine.py.)

Given a course intake date and destination, produces a *backward* plan of
milestones — each with a due date counted back from the intake — so a student
sees exactly what to do and by when (offer → enrolment doc → financial-proof
window → visa application → biometrics → travel).

Milestone shape:
  {
    id:       str,
    label:    str,
    due_date: "YYYY-MM-DD",
    status:   "upcoming",          # user-editable later
    note:     "",
    source:   str | None,          # official guidance URL when relevant
  }
"""

from datetime import date, timedelta

from services.country_sources import COUNTRY_AUTHORITY

VALID_TIMELINE_STATUSES: frozenset[str] = frozenset(
    {"upcoming", "in_progress", "done", "skipped"}
)
DEFAULT_TIMELINE_STATUS = "upcoming"

# Generic backward plan: (days_before_intake, id, label). Country-specific labels
# for the enrolment document and the local fee are filled in per destination.
_BASE_PLAN: list[tuple[int, str, str]] = [
    (240, "secure_admission",  "Secure admission / receive your offer letter"),
    (180, "accept_and_deposit", "Accept your offer and pay the tuition deposit"),
    (150, "enrolment_doc",      "Receive your enrolment confirmation"),     # label overridden
    (120, "financial_proof",    "Hold required funds for 28+ days (financial proof)"),
    (110, "local_requirement",  "Complete the country-specific requirement"),  # label overridden
    (100, "apply_visa",         "Lodge your visa application"),
    (75,  "biometrics",         "Attend biometrics / visa appointment"),
    (45,  "interview_prep",     "Prepare for your visa / credibility interview"),
    (21,  "await_decision",     "Allow time for a decision"),
    (10,  "prepare_travel",     "Book travel and arrange accommodation"),
]

# Country-specific enrolment document (id "enrolment_doc").
_ENROLMENT_LABEL: dict[str, str] = {
    "uk":        "Receive your CAS from the university",
    "usa":       "Receive your Form I-20 from the school",
    "canada":    "Receive your Letter of Acceptance (LOA)",
    "australia": "Receive your Confirmation of Enrolment (CoE)",
}

# Country-specific local requirement (id "local_requirement").
_LOCAL_LABEL: dict[str, str] = {
    "uk":        "Pay the Immigration Health Surcharge (IHS)",
    "usa":       "Pay the SEVIS I-901 fee",
    "canada":    "Open a GIC account for proof of funds",
    "australia": "Arrange Overseas Student Health Cover (OSHC)",
}

# Milestones that should carry the official-guidance citation.
_SOURCED_MILESTONES = {"financial_proof", "apply_visa", "local_requirement"}


def build_timeline(intake_date: date, country: str, profile=None) -> list[dict]:
    """
    Build the backward milestone plan for `intake_date` + `country`.

    `profile` is accepted for future personalization (currently unused).
    Milestones are returned sorted by due_date ascending (soonest first).
    """
    country = (country or "").lower().strip()
    official_url = (COUNTRY_AUTHORITY.get(country) or {}).get("official_url")

    milestones: list[dict] = []
    for days_before, mid, label in _BASE_PLAN:
        if mid == "enrolment_doc":
            label = _ENROLMENT_LABEL.get(country, label)
        elif mid == "local_requirement":
            label = _LOCAL_LABEL.get(country, label)

        milestones.append({
            "id":       mid,
            "label":    label,
            "due_date": (intake_date - timedelta(days=days_before)).isoformat(),
            "status":   DEFAULT_TIMELINE_STATUS,
            "note":     "",
            "source":   official_url if mid in _SOURCED_MILESTONES else None,
        })

    # Add the intake itself as the final milestone.
    milestones.append({
        "id":       "course_start",
        "label":    "Course start (intake)",
        "due_date": intake_date.isoformat(),
        "status":   DEFAULT_TIMELINE_STATUS,
        "note":     "",
        "source":   None,
    })

    milestones.sort(key=lambda m: m["due_date"])
    return milestones
