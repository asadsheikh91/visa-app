"""
financial_proof_engine.py

Sprint 2: Financial Proof Checker engine.

Pure function — no DB, no I/O. The router owns persistence.

Given the user's financial inputs and their destination country, produces:
  - strength rating: "weak" | "moderate" | "strong"
  - required estimate (remaining tuition + living costs)
  - shortfall (0 if funds cover the estimate)
  - critical issues list
  - documents to prepare list
  - checklist_injections: fin_* items to merge into the VisaFile checklist

All monetary values are in the destination country's primary currency.
"""

# ---------------------------------------------------------------------------
# Country living cost estimates — official / commonly cited thresholds
# ---------------------------------------------------------------------------
# UK is rule-driven: a fixed monthly maintenance amount, capped at 9 months,
# different inside vs outside London (UKVI Student route). Other countries use a
# single first-year living-cost figure (proof-of-funds guidance). These figures
# change periodically — keep them in sync with each authority's published rate.

_UK_MAINTENANCE_MONTHLY: dict[str, float] = {
    "london":  1_483.0,   # UKVI: inside London, per month
    "outside": 1_136.0,   # UKVI: outside London, per month
}
_UK_MAX_MAINTENANCE_MONTHS = 9   # UKVI caps maintenance at 9 months

# Single-applicant first-year living-cost figures (proof-of-funds).
_ANNUAL_LIVING_COSTS: dict[str, float] = {
    "usa":       12_000.0,   # estimate; varies by school I-20 cost of attendance
    "canada":    20_635.0,   # IRCC proof-of-funds, outside Quebec, single
    "australia": 29_710.0,   # Home Affairs Subclass 500, single
}
_DEFAULT_LIVING_COST = 10_000.0

# Official guidance link per destination — surfaced on each rule check (Module D).
_FINANCIAL_SOURCES: dict[str, dict] = {
    "uk":        {"label": "UKVI — Student visa money",
                  "url": "https://www.gov.uk/student-visa/money"},
    "usa":       {"label": "U.S. Dept. of State — Student visa",
                  "url": "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html"},
    "canada":    {"label": "IRCC — Proof of funds (study permit)",
                  "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents/proof-funds.html"},
    "australia": {"label": "Home Affairs — Student visa (Subclass 500)",
                  "url": "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500"},
}


def _maintenance(country: str, location: str, months: float) -> float:
    """Living-cost requirement for the destination, location- and length-aware."""
    if country == "uk":
        loc = "london" if location == "london" else "outside"
        m = months if months and months > 0 else _UK_MAX_MAINTENANCE_MONTHS
        m = min(m, _UK_MAX_MAINTENANCE_MONTHS)
        return _UK_MAINTENANCE_MONTHLY[loc] * m
    return _ANNUAL_LIVING_COSTS.get(country, _DEFAULT_LIVING_COST)

_CURRENCY_SYMBOLS: dict[str, str] = {
    "uk":        "£",
    "usa":       "$",
    "canada":    "CAD ",
    "australia":  "AUD ",
}

_CURRENCY_CODES: dict[str, str] = {
    "uk":        "GBP",
    "usa":       "USD",
    "canada":    "CAD",
    "australia": "AUD",
}

# Funding sources that imply a third-party sponsor.
_SPONSOR_SOURCES = {
    "parent_sponsor",
    "family_sponsor",
    "employer_sponsor",
    "other_sponsor",
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

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


def _rc(rule_id: str, label: str, status: str, detail: str,
        threshold: str, source: dict | None) -> dict:
    """One rule-by-rule validator result. status: 'pass' | 'warn' | 'fail'."""
    return {
        "rule_id":   rule_id,
        "label":     label,
        "status":    status,
        "detail":    detail,
        "threshold": threshold,
        "source":    source,
    }


# ---------------------------------------------------------------------------
# Engine — the only public function
# ---------------------------------------------------------------------------

def evaluate(inputs: dict, country: str) -> dict:
    """
    Evaluate a user's financial evidence and return a full assessment.

    inputs keys (all optional — engine handles missing values gracefully):
      tuition_fee             float
      deposit_paid            float
      available_funds         float
      funding_source          str  (self_funded | parent_sponsor | family_sponsor |
                                    employer_sponsor | other_sponsor | scholarship | loan | mixed)
      funds_in_whose_account  str  (own | father | mother | spouse | other_relative)
      bank_statement_status   str  (ready | not_ready | not_sure)
      funds_held_duration     str  (28_days_plus | 3_months_plus |
                                    less_than_28_days | not_sure)
      large_deposits          str  (yes | no | not_sure)
      source_of_funds         str  (salary | business | savings | property_sale | loan | other)
      income_proof_available  str  (yes | no)
      scholarship_or_loan     str  (yes | no)
      course_location         str  (london | outside)  -- UK only, affects maintenance
      course_months           int  (course length in months; UK caps at 9)

    Returns:
      {
        strength:             "weak" | "moderate" | "strong",
        score:                int,
        required_estimate:    float,
        available_funds:      float,
        shortfall:            float,
        currency:             str,
        currency_symbol:      str,
        critical_issues:      list[str],
        documents_to_prepare: list[str],
        rule_checks:          list[dict],   # {rule_id,label,status,detail,threshold,source}
        checklist_injections: list[dict],   # fin_* items WITHOUT status field
        bank_statement_ready: bool,
      }
    """
    country = (country or "").lower().strip()

    tuition_fee      = float(inputs.get("tuition_fee")             or 0)
    deposit_paid     = float(inputs.get("deposit_paid")            or 0)
    available        = float(inputs.get("available_funds")         or 0)
    funding          = (inputs.get("funding_source")               or "").lower()
    bs_status        = (inputs.get("bank_statement_status")        or "not_sure").lower()
    held_duration    = (inputs.get("funds_held_duration")          or "not_sure").lower()
    large_deposits   = (inputs.get("large_deposits")               or "not_sure").lower()
    source_funds     = (inputs.get("source_of_funds")              or "").lower()
    income_proof     = (inputs.get("income_proof_available")       or "no").lower()
    scholarship_loan = (inputs.get("scholarship_or_loan")          or "no").lower()
    course_location  = (inputs.get("course_location")              or "").lower()
    course_months    = float(inputs.get("course_months")           or 0)

    is_sponsor = funding in _SPONSOR_SOURCES

    living_costs      = _maintenance(country, course_location, course_months)
    currency          = _CURRENCY_CODES.get(country, "GBP")
    currency_symbol   = _CURRENCY_SYMBOLS.get(country, "£")
    remaining_tuition = max(0.0, tuition_fee - deposit_paid)
    required_estimate = remaining_tuition + living_costs
    shortfall         = max(0.0, required_estimate - available)

    # ── Scoring (0–100, deductions for each weakness) ────────────────────────
    score = 100

    if available < required_estimate:
        score -= 40
    if available < required_estimate * 0.5:
        score -= 20                          # severe shortfall carries double penalty
    if bs_status != "ready":
        score -= 25
    if held_duration in ("less_than_28_days", "not_sure"):
        score -= 20
    if large_deposits == "yes":
        score -= 10
    elif large_deposits == "not_sure":
        score -= 5
    if is_sponsor and income_proof != "yes":
        score -= 15

    score = max(0, score)

    if score >= 70:
        strength = "strong"
    elif score >= 40:
        strength = "moderate"
    else:
        strength = "weak"

    # ── Critical issues ───────────────────────────────────────────────────────
    issues: list[str] = []

    if available < required_estimate:
        issues.append(
            f"Available funds ({currency_symbol}{available:,.0f}) appear below the "
            f"estimated minimum requirement ({currency_symbol}{required_estimate:,.0f})."
        )
    if is_sponsor and income_proof != "yes":
        issues.append(
            "Sponsor income proof is missing — salary slips or business accounts "
            "must be provided when a third party funds your studies."
        )
    if bs_status != "ready":
        issues.append(
            "Bank statement is not ready. It must show the required balance "
            "held continuously for the full required period before your application date."
        )
    if held_duration in ("less_than_28_days", "not_sure"):
        issues.append(
            "Funds holding duration does not clearly satisfy the 28-day rule. "
            "Most countries require funds to be in the account for at least 28 consecutive days."
        )
    if large_deposits == "yes":
        issues.append(
            "Large deposits present — a source of funds explanation and supporting "
            "evidence are required for every unusually large credit."
        )

    # ── Documents to prepare ─────────────────────────────────────────────────
    docs: list[str] = [
        "Bank statement (covering the required holding period)",
        "Bank certificate / balance confirmation letter",
    ]

    if deposit_paid > 0:
        docs.append("Tuition deposit receipt / payment confirmation")

    if is_sponsor:
        docs.append("Sponsor's bank statements")
        docs.append("Sponsor's bank certificate")
        if income_proof != "yes":
            docs.append("Sponsor income proof (salary slips / business accounts / tax returns)")
        docs.append("Proof of sponsor relationship (birth certificate / family records)")

    if large_deposits in ("yes", "not_sure"):
        docs.append("Source of funds explanation letter")
    if large_deposits == "yes":
        docs.append(
            "Supporting evidence for large deposits "
            "(e.g. property deed, sale agreement, inheritance document)"
        )

    if scholarship_loan == "yes":
        docs.append("Scholarship award letter / Loan sanction letter")

    if source_funds == "property_sale":
        docs.append("Property sale deed / proof of sale proceeds")

    # ── Checklist injections (fin_* items) ───────────────────────────────────
    injections: list[dict] = []

    injections.append(_item(
        "fin_bank_statement",
        "Bank statement (financial proof)",
        "financial", "critical",
        "Your bank statement is the primary financial evidence for your visa application.",
        "Ensure the statement is official (bank-stamped or digitally certified), covers the "
        "full required period, and shows a closing balance that meets the financial threshold. "
        "It must be dated within 31 days of your application.",
    ))
    injections.append(_item(
        "fin_bank_certificate",
        "Bank certificate / balance confirmation letter",
        "financial", "critical",
        "A bank-issued letter confirming your account balance strengthens your financial evidence.",
        "Request a certificate from your bank stating your account balance and confirming the "
        "account has been held for the required duration. Most visa officers expect this alongside "
        "the bank statement.",
    ))

    if deposit_paid > 0:
        injections.append(_item(
            "fin_tuition_deposit_receipt",
            "Tuition deposit receipt",
            "financial", "high",
            "Paying a deposit reduces the remaining balance you need to demonstrate.",
            "Obtain an official receipt from your university for the tuition deposit paid. "
            "This directly reduces the financial threshold you must meet.",
        ))

    if large_deposits in ("yes", "not_sure"):
        injections.append(_item(
            "fin_source_of_funds_letter",
            "Source of funds explanation letter",
            "financial", "critical",
            "Any large or unusual credit in your bank account must be explained in writing.",
            "Write a signed statement explaining the origin of each large deposit, referencing "
            "specific transaction dates and amounts. Attach supporting evidence for each one.",
        ))

    if large_deposits == "yes":
        injections.append(_item(
            "fin_large_deposits_evidence",
            "Supporting evidence for large deposits",
            "financial", "critical",
            "Unexplained large credits raise a red flag without documentary backing.",
            "Provide the underlying document for each large deposit: property deed, salary "
            "certificate, inheritance letter, sale agreement, or equivalent.",
        ))

    if is_sponsor:
        injections.append(_item(
            "fin_sponsor_income_proof",
            "Sponsor income proof",
            "sponsor", "critical",
            "The visa officer must verify your sponsor can fund your studies from ongoing income, "
            "not just accumulated savings.",
            "Collect your sponsor's last 3–6 months of salary slips, an employer letter, or "
            "certified business accounts / tax returns if the sponsor is self-employed.",
        ))

    if scholarship_loan == "yes":
        injections.append(_item(
            "fin_scholarship_or_loan_letter",
            "Scholarship or loan award letter",
            "financial", "high",
            "Official documentation of a scholarship or loan is required to count it as a "
            "recognised funding source.",
            "Obtain the official award or sanction letter from the scholarship body or financial "
            "institution. It must state the amount, duration, and disbursement schedule.",
        ))

    # ── Rule-by-rule validation (Module B) ───────────────────────────────────
    src = _FINANCIAL_SOURCES.get(country, _FINANCIAL_SOURCES["uk"])
    rule_checks: list[dict] = []

    # 1. Maintenance / total funds threshold
    rule_checks.append(_rc(
        "maintenance_amount",
        "Funds meet the required amount",
        "pass" if available >= required_estimate else "fail",
        (
            f"You have {currency_symbol}{available:,.0f} against an estimated "
            f"{currency_symbol}{required_estimate:,.0f} (remaining tuition + living costs)."
            + (f" Shortfall of {currency_symbol}{shortfall:,.0f}." if shortfall > 0 else "")
        ),
        f"{currency_symbol}{required_estimate:,.0f}",
        src,
    ))

    # 2. 28-day holding period
    if held_duration in ("28_days_plus", "3_months_plus"):
        hp_status, hp_detail = "pass", "Funds have been held for the required period."
    elif held_duration == "less_than_28_days":
        hp_status, hp_detail = "fail", (
            "Funds have been held for less than 28 days — most visa routes require the "
            "balance to sit in the account for at least 28 consecutive days."
        )
    else:
        hp_status, hp_detail = "warn", (
            "Holding period is unconfirmed. Funds must be held for at least 28 consecutive "
            "days ending no more than 31 days before you apply."
        )
    rule_checks.append(_rc(
        "holding_period_28_days",
        "28-day holding period",
        hp_status, hp_detail, "28 consecutive days", src,
    ))

    # 3. Bank statement official + recency
    if bs_status == "ready":
        bs_st, bs_detail = "pass", (
            "Bank statement is ready. Confirm it is official (bank-stamped or digitally "
            "certified) and dated within 31 days of your application."
        )
    elif bs_status == "not_ready":
        bs_st, bs_detail = "fail", (
            "Bank statement is not ready. An official statement is the primary financial "
            "evidence — an application cannot succeed without it."
        )
    else:
        bs_st, bs_detail = "warn", (
            "Bank statement status is uncertain. Prepare an official statement dated within "
            "31 days of applying."
        )
    rule_checks.append(_rc(
        "bank_statement_ready",
        "Official, recent bank statement",
        bs_st, bs_detail, "Dated within 31 days of applying", src,
    ))

    # 4. Sponsor evidence (only when third-party funded)
    if is_sponsor:
        rule_checks.append(_rc(
            "sponsor_income_proof",
            "Sponsor income proof",
            "pass" if income_proof == "yes" else "fail",
            (
                "Sponsor income proof is available."
                if income_proof == "yes" else
                "A third party is funding you, but sponsor income proof (salary slips / "
                "business accounts) is missing."
            ),
            "Required for sponsored applicants", src,
        ))

    # 5. Large deposits explanation
    if large_deposits == "no":
        ld_st, ld_detail = "pass", "No large or unusual deposits to explain."
    elif large_deposits == "yes":
        ld_st, ld_detail = "fail", (
            "Large deposits present — each must have a written source-of-funds explanation "
            "and supporting evidence, or it will be treated as a red flag."
        )
    else:
        ld_st, ld_detail = "warn", (
            "Unsure about large deposits. Review your statement: any unusually large credit "
            "needs a documented explanation."
        )
    rule_checks.append(_rc(
        "large_deposits_explained",
        "Large deposits explained",
        ld_st, ld_detail, "Every large credit documented", src,
    ))

    return {
        "strength":             strength,
        "score":                score,
        "required_estimate":    required_estimate,
        "available_funds":      available,
        "shortfall":            shortfall,
        "currency":             currency,
        "currency_symbol":      currency_symbol,
        "critical_issues":      issues,
        "documents_to_prepare": docs,
        "rule_checks":          rule_checks,
        "checklist_injections": injections,
        "bank_statement_ready": bs_status == "ready",
    }
