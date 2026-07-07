"""
checklist_engine.py

The rules engine behind the Visa File Builder (Sprint 1).

Given a user's visa profile and (optionally) their latest readiness check, it
produces a personalised, grouped document checklist. Each item carries a stable
id, a human title, a category, a priority, a *reason it exists*, and concrete
user guidance — so the checklist explains itself rather than just naming files.

Pure functions only — no DB, no I/O. The service layer owns persistence and the
default item status.

Inputs
  profile : dict   (from UserVisaProfile — see _profile keys used below)
  check   : dict | None   {country, score, result, critical_blockers,
                           high_risk_flags, soft_warnings, ...}
  country : str    (lowercase slug: uk | usa | canada | australia)

Output
  list[dict]   each: {id, title, category, priority, reason, guidance}
               (status is added by the service layer)
"""

from typing import Any

# ---------------------------------------------------------------------------
# Vocabulary
# ---------------------------------------------------------------------------

CATEGORY_LABELS: dict[str, str] = {
    "identity":         "Identity & Travel",
    "admission":        "Admission Documents",
    "academic":         "Academic Documents",
    "financial":        "Financial Documents",
    "sponsor":          "Sponsor Documents",
    "country_specific": "Country-Specific Requirements",
    "story":            "Story & Explanation",
}

# Render order for categories in the UI.
CATEGORY_ORDER: list[str] = [
    "identity",
    "admission",
    "academic",
    "financial",
    "sponsor",
    "country_specific",
    "story",
]

PRIORITY_ORDER: dict[str, int] = {"critical": 0, "high": 1, "standard": 2}

# Checklist item statuses the user can set.
VALID_STATUSES: frozenset[str] = frozenset(
    {"missing", "in_progress", "available", "not_applicable", "needs_review"}
)
DEFAULT_STATUS = "missing"

# Statuses that count as "done" / resolved for completion math.
RESOLVED_STATUSES: frozenset[str] = frozenset({"available", "not_applicable"})


def _item(item_id: str, title: str, category: str, priority: str,
          reason: str, guidance: str) -> dict:
    return {
        "id":       item_id,
        "title":    title,
        "category": category,
        "priority": priority,
        "reason":   reason,
        "guidance": guidance,
    }


# ---------------------------------------------------------------------------
# Base items — common to every student visa, any country
# ---------------------------------------------------------------------------

def _base_items() -> list[dict]:
    return [
        _item(
            "passport", "Valid passport", "identity", "critical",
            "Every visa application needs a passport valid for the duration of your stay.",
            "Check your passport has at least 6 months' validity beyond your intended "
            "travel date and a few blank pages. Renew early if it is close to expiry.",
        ),
        _item(
            "photographs", "Passport-size photographs", "identity", "standard",
            "Visa and biometric appointments require recent photos to the exact spec.",
            "Get digital + printed photos that meet the destination country's size and "
            "background rules. Keep a few spares.",
        ),
        _item(
            "academic_transcripts", "Academic transcripts", "academic", "high",
            "Your transcripts prove the qualifications your offer was based on.",
            "Gather official transcripts for every qualification on your application. "
            "Order certified copies if originals can't be released.",
        ),
        _item(
            "degree_certificates", "Degree / completion certificates", "academic", "high",
            "Certificates confirm you actually completed the qualifications you claim.",
            "Collect originals (or certified copies) of every degree, diploma, or school "
            "leaving certificate referenced in your application.",
        ),
        _item(
            "english_test", "English language test result", "academic", "critical",
            "Most student visas and universities require proof of English proficiency.",
            "Book and pass an accepted test (IELTS / TOEFL / PTE) before the deadline. "
            "Confirm your score meets both the university and visa thresholds.",
        ),
        _item(
            "personal_statement", "Statement of purpose / personal statement", "story", "high",
            "A clear study rationale is central to showing you are a genuine student.",
            "Write a focused statement: why this course, this university, this country, "
            "and how it fits your career plan back home.",
        ),
    ]


# ---------------------------------------------------------------------------
# Country-specific items
# ---------------------------------------------------------------------------

def _country_items(country: str) -> list[dict]:
    if country == "uk":
        return [
            _item(
                "uk_cas", "CAS (Confirmation of Acceptance for Studies)", "admission", "critical",
                "The UK Student Route requires a valid CAS from your sponsoring university.",
                "Your university issues the CAS once you accept your offer and meet its "
                "conditions. Check every detail (name, course, fees) before you apply.",
            ),
            _item(
                "uk_tb_test", "Tuberculosis (TB) test certificate", "country_specific", "critical",
                "Applicants from listed countries must submit a TB test certificate.",
                "Book a test at a UKVI-approved clinic and keep the certificate — it is "
                "usually valid for 6 months.",
            ),
            _item(
                "uk_financial_maintenance", "Financial maintenance evidence (28-day rule)",
                "financial", "critical",
                "You must show course fees plus living costs held for 28 consecutive days.",
                "Hold the required funds for 28 straight days and use a statement dated "
                "within 31 days of applying. The closing balance must never dip below the "
                "threshold during that window.",
            ),
            _item(
                "uk_atas", "ATAS clearance (if your course requires it)", "country_specific", "standard",
                "Certain postgraduate science/technology courses need ATAS clearance.",
                "Check whether your CAS lists an ATAS requirement. If it does, apply for "
                "the certificate early — it can take weeks. Mark Not Applicable otherwise.",
            ),
        ]

    if country == "usa":
        return [
            _item(
                "usa_i20", "Form I-20", "admission", "critical",
                "An F-1 visa requires a Form I-20 issued by an SEVP-approved school.",
                "Your school issues the I-20 after you're admitted and submit financial "
                "documents. Verify your name and SEVIS ID match your passport.",
            ),
            _item(
                "usa_ds160", "DS-160 confirmation page", "country_specific", "critical",
                "The DS-160 online application is mandatory before booking your interview.",
                "Complete the DS-160 carefully, upload a compliant photo, and print the "
                "confirmation page with the barcode for your interview.",
            ),
            _item(
                "usa_sevis_fee", "SEVIS I-901 fee receipt", "financial", "critical",
                "The SEVIS fee must be paid before your visa interview.",
                "Pay the I-901 fee online using your SEVIS ID and print the receipt.",
            ),
            _item(
                "usa_visa_appointment", "Visa interview appointment confirmation",
                "country_specific", "high",
                "F-1 applicants must attend an in-person interview at the US embassy/consulate.",
                "Book your appointment early — wait times vary. Bring the appointment "
                "confirmation and all supporting documents.",
            ),
            _item(
                "usa_interview_prep", "Visa interview preparation", "story", "high",
                "The interview is where a genuine-student decision is largely made.",
                "Prepare clear, honest answers about your course, funding, and post-study "
                "plans to return home. Practise concise responses.",
            ),
        ]

    if country == "canada":
        return [
            _item(
                "can_loa", "Letter of Acceptance (LOA)", "admission", "critical",
                "A study permit requires an LOA from a Designated Learning Institution.",
                "Confirm your LOA is from a DLI and lists your program and start date "
                "correctly.",
            ),
            _item(
                "can_proof_of_funds", "Proof of funds (GIC / bank evidence)", "financial", "critical",
                "You must prove you can cover tuition and living costs (often via a GIC).",
                "Arrange a Guaranteed Investment Certificate or equivalent proof of funds "
                "meeting the current IRCC living-cost requirement plus tuition.",
            ),
            _item(
                "can_sop", "Statement of Purpose / study plan", "story", "critical",
                "IRCC weighs your study plan heavily when judging genuine intent.",
                "Explain your program choice, how it builds on your background, and your "
                "plan to return home after studies.",
            ),
            _item(
                "can_family_ties", "Evidence of ties to home country", "story", "high",
                "Strong home ties counter any 'will not leave Canada' concern.",
                "Gather evidence of family, property, or career commitments that pull you "
                "back home after your studies.",
            ),
            _item(
                "can_pal", "Provincial/Territorial Attestation Letter (PAL/TAL)",
                "country_specific", "high",
                "Most study permit applications now require a PAL or TAL from the province.",
                "Request the attestation letter from your province/territory once you have "
                "your LOA. Mark Not Applicable only if your category is exempt.",
            ),
        ]

    if country == "australia":
        return [
            _item(
                "aus_coe", "Confirmation of Enrolment (CoE)", "admission", "critical",
                "The Subclass 500 visa requires a CoE from your education provider.",
                "Your provider issues the CoE after you accept the offer and pay the "
                "required deposit. Check the course and dates are correct.",
            ),
            _item(
                "aus_oshc", "Overseas Student Health Cover (OSHC)", "country_specific", "critical",
                "OSHC for the full visa period is mandatory for Subclass 500 applicants.",
                "Buy OSHC covering your entire stay from an approved provider and keep the "
                "policy confirmation.",
            ),
            _item(
                "aus_gs_statement", "Genuine Student (GS) statement", "story", "critical",
                "The GS requirement replaced GTE and is central to the visa decision.",
                "Address the GS questions directly: your circumstances, why this course, "
                "and how it fits your future plans. Be specific and consistent.",
            ),
            _item(
                "aus_financial_capacity", "Financial capacity evidence", "financial", "critical",
                "You must demonstrate funds for tuition, living costs, and travel.",
                "Prepare evidence (savings, sponsor funds, or loan) meeting the current "
                "Home Affairs financial-capacity amount.",
            ),
            _item(
                "aus_immigration_history", "Immigration history evidence", "story", "high",
                "Your visa and travel history feeds the genuine-student assessment.",
                "Compile your prior visa records and travel history; be ready to explain "
                "any prior refusals or overstays honestly.",
            ),
        ]

    # Unknown country — base items only.
    return []


# ---------------------------------------------------------------------------
# Conditional items — driven by the user's profile
# ---------------------------------------------------------------------------

# Funding sources that imply a third-party sponsor.
_SPONSOR_FUNDING = {"family_sponsored", "employer_sponsored"}
# Sponsor relationships that imply a personal (non-employer) sponsor.
_FAMILY_SPONSOR = {"parent", "sibling", "relative", "spouse"}


def _conditional_items(profile: dict) -> list[dict]:
    items: list[dict] = []

    funding   = (profile.get("funding_source") or "").lower()
    sponsor   = (profile.get("sponsor_relationship") or "").lower()
    refusal   = (profile.get("previous_refusal") or "").lower()
    gap       = (profile.get("study_gap") or "").lower()
    deps      = (profile.get("dependants") or "").lower()

    # Sponsor documents — when someone else funds the studies.
    if funding in _SPONSOR_FUNDING or sponsor in _FAMILY_SPONSOR:
        items.append(_item(
            "sponsor_letter", "Sponsorship letter / affidavit of support", "sponsor", "critical",
            "A third party is funding your studies, so the visa officer needs their "
            "written commitment.",
            "Get a signed sponsorship letter (or affidavit) stating your sponsor will "
            "cover your fees and living costs, and their relationship to you.",
        ))
        items.append(_item(
            "sponsor_bank_statements", "Sponsor's bank statements", "sponsor", "critical",
            "Funds must be shown in the sponsor's account, not just declared.",
            "Provide your sponsor's recent bank statements proving the required funds are "
            "genuinely available, consistent with the financial-evidence rules.",
        ))
        items.append(_item(
            "sponsor_relationship_proof", "Sponsor ID & proof of relationship", "sponsor", "high",
            "The officer must confirm who the sponsor is and how they relate to you.",
            "Include the sponsor's ID and documents proving your relationship "
            "(e.g. birth certificate, family registration, or employment letter).",
        ))

    # Refusal documents — when the user has a previous visa refusal.
    if refusal == "yes":
        items.append(_item(
            "previous_refusal_letter", "Previous refusal letter(s)", "story", "critical",
            "You disclosed a previous visa refusal, which must be addressed head-on.",
            "Keep a copy of every previous refusal letter. Hiding a refusal is far more "
            "damaging than explaining it.",
        ))
        items.append(_item(
            "refusal_explanation", "Written explanation addressing the refusal",
            "story", "critical",
            "Officers want to see what changed since the refusal.",
            "Write a clear note explaining the earlier refusal reason and exactly what you "
            "have fixed or strengthened since.",
        ))

    # Study-gap explanation.
    if gap == "yes":
        items.append(_item(
            "gap_explanation", "Study / employment gap explanation", "story", "high",
            "You indicated a gap in your study history, which invites questions.",
            "Write a short explanation of what you did during the gap (work, family, "
            "preparation) and attach any supporting evidence (letters, payslips).",
        ))

    # Dependant documents.
    if deps == "yes":
        items.append(_item(
            "dependant_documents", "Dependant visa documents", "country_specific", "high",
            "You plan to bring dependants, who need their own supporting documents.",
            "Prepare marriage/birth certificates, dependant passports and photos, and "
            "evidence of extra funds to cover them.",
        ))

    return items


# ---------------------------------------------------------------------------
# Readiness-derived items — tie the file to the user's actual check result
# ---------------------------------------------------------------------------

def _short_title(message: str, limit: int = 60) -> str:
    text = (message or "").strip().replace("\n", " ")
    if not text:
        return "readiness item"
    # Cut at the first sentence boundary if it is reasonably short.
    for sep in (". ", "! ", "? "):
        idx = text.find(sep)
        if 0 < idx <= limit:
            return text[:idx].strip()
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].strip() + "…"


def _issue_id(prefix: str, issue: dict, index: int) -> str:
    qid = issue.get("question_id") or f"{index}"
    return f"fix_{prefix}_{qid}"


def _readiness_items(check: dict) -> list[dict]:
    """
    Turns the latest check's blockers / high-risk flags into checklist items so
    the file reflects the user's real readiness result instead of feeling random.
    Soft warnings are intentionally left out of the file to avoid noise.
    """
    items: list[dict] = []

    blockers = check.get("critical_blockers") or []
    flags    = check.get("high_risk_flags")  or []

    for i, b in enumerate(blockers):
        if not isinstance(b, dict):
            continue
        msg = b.get("message") or ""
        items.append(_item(
            _issue_id("blocker", b, i),
            f"Resolve: {_short_title(msg)}",
            "story", "critical",
            msg or "Flagged as a critical blocker in your readiness check.",
            "This was a critical blocker in your latest readiness check. It must be "
            "resolved — gather the evidence or fix the underlying issue before you apply.",
        ))

    for i, f in enumerate(flags):
        if not isinstance(f, dict):
            continue
        msg = f.get("message") or ""
        items.append(_item(
            _issue_id("flag", f, i),
            f"Address: {_short_title(msg)}",
            "story", "high",
            msg or "Flagged as a high-risk item in your readiness check.",
            "This was a high-risk flag in your latest readiness check. Prepare supporting "
            "evidence or an explanation to reduce the risk of refusal.",
        ))

    return items


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------

def _dedupe(items: list[dict]) -> list[dict]:
    """Keep the first occurrence of each item id."""
    seen: set[str] = set()
    out: list[dict] = []
    for it in items:
        iid = it.get("id")
        if not iid or iid in seen:
            continue
        seen.add(iid)
        out.append(it)
    return out


def _sort_key(it: dict) -> tuple[int, int]:
    cat = CATEGORY_ORDER.index(it["category"]) if it["category"] in CATEGORY_ORDER else len(CATEGORY_ORDER)
    pri = PRIORITY_ORDER.get(it.get("priority", "standard"), 99)
    return (cat, pri)


def build_checklist(profile: dict | None, check: dict | None, country: str) -> list[dict]:
    """
    Build the full personalised checklist for a country, profile, and (optional)
    latest readiness check. Returns items WITHOUT status (the service adds it).
    """
    profile = profile or {}
    country = (country or "").lower().strip()

    items: list[dict] = []
    items += _base_items()
    items += _country_items(country)
    items += _conditional_items(profile)
    if check:
        items += _readiness_items(check)

    items = _dedupe(items)
    items.sort(key=_sort_key)
    return items


def category_meta() -> list[dict]:
    """[{key, label}] in render order — for the frontend."""
    return [{"key": k, "label": CATEGORY_LABELS[k]} for k in CATEGORY_ORDER]


def sort_items(items: list[dict]) -> list[dict]:
    """Sort checklist items by canonical category + priority order."""
    return sorted(items, key=_sort_key)
