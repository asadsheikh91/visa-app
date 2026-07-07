"""
seed_document_guidance.py

Seeds the Document Guidance Module.
  Countries : United Kingdom, United States, Canada, Australia
  Persona   : master's applicant who studied in Pakistan
  Offices   : Islamabad / Rawalpindi only

Run from the backend/ directory:
    python -m scripts.seed_document_guidance

Idempotent: offices + documents are upserted by their slug id; edges are cleared
and re-inserted. User progress (user_document_state) is never touched.

╔══════════════════════════════════════════════════════════════════════════════╗
║  EVERY fee, duration, address, appointment URL, last_verified_at AND the       ║
║  per-document `country_relevance` (which documents each country actually needs) ║
║  below is a PLACEHOLDER. Verify each against its official_url before launch.    ║
║  Prefer leaving a cost `None` (UI shows the official link) over shipping a      ║
║  number you can't re-verify. The module's whole value is being accurate.        ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
from datetime import datetime

from sqlalchemy import delete

from database import async_session_maker, engine, Base
from models import Office, DocumentRef, DocumentEdge

# PLACEHOLDER — set to the date you actually verified the rows below.
LAST_VERIFIED = datetime(2026, 1, 1)

ALL = ["uk", "usa", "canada", "australia"]

# ── Offices (Islamabad / Rawalpindi only) ────────────────────────────────────
# PLACEHOLDER addresses / coords / hours / appointment URLs — verify each.
OFFICES = [
    {
        "id": "nadra_blue_area",
        "authority": "NADRA (National Database & Registration Authority)",
        "city": "Islamabad", "address": "NADRA Registration Centre, Blue Area, Islamabad",
        "lat": 33.7141, "lng": 73.0560, "hours": "Mon–Sat 8:30am–4:30pm",
        "online_appointment_url": "https://id.nadra.gov.pk/",
    },
    {
        "id": "dgip_passport_islamabad",
        "authority": "Directorate General of Immigration & Passports",
        "city": "Islamabad", "address": "Regional Passport Office, G-8, Islamabad",
        "lat": 33.7000, "lng": 73.0479, "hours": "Mon–Fri 8:00am–2:00pm",
        "online_appointment_url": "https://onlinemrp.dgip.gov.pk/",
    },
    {
        "id": "hec_islamabad",
        "authority": "Higher Education Commission (HEC)",
        "city": "Islamabad", "address": "HEC Secretariat, H-9, Islamabad",
        "lat": 33.6710, "lng": 73.0330, "hours": "Mon–Fri 9:00am–5:00pm",
        "online_appointment_url": "https://eportal.hec.gov.pk/",
    },
    {
        "id": "ibcc_islamabad",
        "authority": "Inter Board Coordination Commission (IBCC)",
        "city": "Islamabad", "address": "IBCC Head Office, Islamabad",
        "lat": 33.6844, "lng": 73.0479, "hours": "Mon–Fri 9:00am–4:00pm",
        "online_appointment_url": "https://ibcc.edu.pk/",
    },
    {
        "id": "iom_tb_rawalpindi",
        "authority": "IOM-approved TB testing clinic (UK)",
        "city": "Rawalpindi", "address": "IOM-approved panel clinic, Rawalpindi",
        "lat": 33.5970, "lng": 73.0479, "hours": "By appointment",
        "online_appointment_url": "https://www.gov.uk/tb-test-visa/pakistan",
    },
    {
        "id": "panel_physician_islamabad",
        "authority": "Panel physician (immigration medical — CA/AU)",
        "city": "Islamabad", "address": "Approved panel physician clinic, Islamabad",  # PLACEHOLDER
        "lat": 33.7000, "lng": 73.0500, "hours": "By appointment",                      # PLACEHOLDER
        "online_appointment_url": None,   # verify panel list per destination
    },
    {
        "id": "us_embassy_islamabad",
        "authority": "U.S. Embassy Islamabad (visa interview)",
        "city": "Islamabad", "address": "Diplomatic Enclave, Islamabad",               # PLACEHOLDER
        "lat": 33.7220, "lng": 73.1100, "hours": "By appointment",                      # PLACEHOLDER
        "online_appointment_url": "https://www.ustraveldocs.com/pk/",                   # verify
    },
]

# ── Documents ────────────────────────────────────────────────────────────────
# `country_relevance` lists which destinations need each document — VERIFY THESE.
# All cost/days are PLACEHOLDER; left None where genuinely volatile/unknown.
DOCUMENTS = [
    # ----- Shared Pakistan-side documents (needed for every destination) -----
    {
        "id": "cnic", "name": "CNIC (Computerised National Identity Card)",
        "country_relevance": ALL, "issuing_authority": "NADRA", "office_id": "nadra_blue_area",
        "official_url": "https://id.nadra.gov.pk/",
        "normal_cost": None, "urgent_cost": None, "normal_days": 30, "urgent_days": 7,
        "validity_months": None, "display_order": 1,
    },
    {
        "id": "passport", "name": "Passport (machine-readable / e-passport)",
        "country_relevance": ALL, "issuing_authority": "DGI&P", "office_id": "dgip_passport_islamabad",
        "official_url": "https://onlinemrp.dgip.gov.pk/",
        "normal_cost": None, "urgent_cost": None, "normal_days": 21, "urgent_days": 7,
        "validity_months": None, "display_order": 2,
    },
    {
        "id": "bachelors_degree", "name": "Bachelor's degree certificate",
        "country_relevance": ALL, "issuing_authority": "Awarding university", "office_id": None,
        "official_url": None,
        "normal_cost": None, "urgent_cost": None, "normal_days": None, "urgent_days": None,
        "validity_months": None, "display_order": 3,
    },
    {
        "id": "bachelors_transcript", "name": "Bachelor's transcript / mark sheets",
        "country_relevance": ALL, "issuing_authority": "Awarding university", "office_id": None,
        "official_url": None,
        "normal_cost": None, "urgent_cost": None, "normal_days": None, "urgent_days": None,
        "validity_months": None, "display_order": 4,
    },
    {
        "id": "hec_attestation", "name": "HEC attestation of degree & transcript",
        "country_relevance": ALL, "issuing_authority": "HEC", "office_id": "hec_islamabad",
        "official_url": "https://eportal.hec.gov.pk/",
        "normal_cost": None, "urgent_cost": None, "normal_days": 10, "urgent_days": 1,
        "validity_months": None, "display_order": 5,
    },
    {
        # Conditional: only when relying on an intermediate-level qualification.
        "id": "ibcc_equivalence", "name": "IBCC equivalence certificate",
        "country_relevance": ALL, "issuing_authority": "IBCC", "office_id": "ibcc_islamabad",
        "official_url": "https://ibcc.edu.pk/",
        "normal_cost": None, "urgent_cost": None, "normal_days": None, "urgent_days": None,
        "validity_months": None, "display_order": 6,
    },
    {
        # PLACEHOLDER relevance — confirm which destinations require a PCC for this
        # persona/course (commonly UK/CA/AU; usually not required for US F-1).
        "id": "police_character_certificate", "name": "Police character certificate (PCC)",
        "country_relevance": ["uk", "canada", "australia"], "issuing_authority": "NADRA / Police",
        "office_id": "nadra_blue_area", "official_url": "https://pcc.nadra.gov.pk/",
        "normal_cost": None, "urgent_cost": None, "normal_days": 14, "urgent_days": 3,
        "validity_months": 6, "display_order": 7,
    },

    # ----- United Kingdom -----
    {
        "id": "tb_test_certificate", "name": "TB test certificate (UK-mandatory)",
        "country_relevance": ["uk"], "issuing_authority": "IOM-approved clinic",
        "office_id": "iom_tb_rawalpindi", "official_url": "https://www.gov.uk/tb-test-visa/pakistan",
        "normal_cost": None, "urgent_cost": None, "normal_days": 5, "urgent_days": 2,
        "validity_months": 6, "display_order": 10,
    },

    # ----- United States (F-1) -----
    {
        "id": "i20_form", "name": "Form I-20 (from your university)",
        "country_relevance": ["usa"], "issuing_authority": "Admitting U.S. school", "office_id": None,
        "official_url": "https://studyinthestates.dhs.gov/students/get-ready/getting-your-form-i-20",
        "normal_cost": None, "urgent_cost": None, "normal_days": None, "urgent_days": None,
        "validity_months": None, "display_order": 11,
    },
    {
        "id": "sevis_fee_receipt", "name": "SEVIS I-901 fee receipt",
        "country_relevance": ["usa"], "issuing_authority": "U.S. ICE / SEVP", "office_id": None,
        "official_url": "https://www.fmjfee.com/",
        "normal_cost": None, "urgent_cost": None, "normal_days": 1, "urgent_days": 1,  # PLACEHOLDER fee
        "validity_months": None, "display_order": 12,
    },
    {
        "id": "ds160_confirmation", "name": "DS-160 confirmation + interview appointment",
        "country_relevance": ["usa"], "issuing_authority": "U.S. Dept. of State", "office_id": "us_embassy_islamabad",
        "official_url": "https://ceac.state.gov/genniv/",
        "normal_cost": None, "urgent_cost": None, "normal_days": None, "urgent_days": None,
        "validity_months": None, "display_order": 13,
    },

    # ----- Canada (Study Permit) -----
    {
        "id": "loa_canada", "name": "Letter of Acceptance (LOA) from a DLI",
        "country_relevance": ["canada"], "issuing_authority": "Designated Learning Institution", "office_id": None,
        "official_url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html",
        "normal_cost": None, "urgent_cost": None, "normal_days": None, "urgent_days": None,
        "validity_months": None, "display_order": 11,
    },
    {
        "id": "pal_canada", "name": "Provincial Attestation Letter (PAL)",
        "country_relevance": ["canada"], "issuing_authority": "Province / territory", "office_id": None,
        "official_url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents.html",
        "normal_cost": None, "urgent_cost": None, "normal_days": None, "urgent_days": None,
        "validity_months": None, "display_order": 12,
    },
    {
        "id": "gic_canada", "name": "GIC (proof of funds)",
        "country_relevance": ["canada"], "issuing_authority": "Participating bank", "office_id": None,
        "official_url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents/proof-funds.html",
        "normal_cost": None, "urgent_cost": None, "normal_days": None, "urgent_days": None,
        "validity_months": None, "display_order": 13,
    },
    {
        "id": "medical_exam_canada", "name": "Immigration medical exam (IRCC panel)",
        "country_relevance": ["canada"], "issuing_authority": "IRCC panel physician", "office_id": "panel_physician_islamabad",
        "official_url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents.html",
        "normal_cost": None, "urgent_cost": None, "normal_days": 7, "urgent_days": 3,
        "validity_months": 12, "display_order": 14,
    },
    {
        "id": "biometrics_canada", "name": "Biometrics (VAC appointment)",
        "country_relevance": ["canada"], "issuing_authority": "VFS Global (IRCC)", "office_id": None,
        "official_url": "https://www.canada.ca/en/immigration-refugees-citizenship/campaigns/biometrics.html",
        "normal_cost": None, "urgent_cost": None, "normal_days": None, "urgent_days": None,
        "validity_months": None, "display_order": 15,
    },

    # ----- Australia (Subclass 500) -----
    {
        "id": "coe_australia", "name": "Confirmation of Enrolment (CoE)",
        "country_relevance": ["australia"], "issuing_authority": "Australian institution", "office_id": None,
        "official_url": "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500",
        "normal_cost": None, "urgent_cost": None, "normal_days": None, "urgent_days": None,
        "validity_months": None, "display_order": 11,
    },
    {
        "id": "oshc_australia", "name": "Overseas Student Health Cover (OSHC)",
        "country_relevance": ["australia"], "issuing_authority": "Approved OSHC provider", "office_id": None,
        "official_url": "https://www.health.gov.au/topics/migration/oshc",
        "normal_cost": None, "urgent_cost": None, "normal_days": None, "urgent_days": None,
        "validity_months": None, "display_order": 12,
    },
    {
        "id": "health_exam_australia", "name": "Health examination (Home Affairs panel)",
        "country_relevance": ["australia"], "issuing_authority": "Home Affairs panel clinic", "office_id": "panel_physician_islamabad",
        "official_url": "https://immi.homeaffairs.gov.au/help-support/meeting-our-requirements/health",
        "normal_cost": None, "urgent_cost": None, "normal_days": 7, "urgent_days": 3,
        "validity_months": 12, "display_order": 13,
    },
    {
        "id": "biometrics_australia", "name": "Biometrics (ABIS appointment)",
        "country_relevance": ["australia"], "issuing_authority": "Australian Biometric Collection Centre", "office_id": None,
        "official_url": "https://immi.homeaffairs.gov.au/help-support/meeting-our-requirements/biometrics",
        "normal_cost": None, "urgent_cost": None, "normal_days": None, "urgent_days": None,
        "validity_months": None, "display_order": 14,
    },
]

# ── Prerequisite edges (the DAG) ─────────────────────────────────────────────
# (document_id, requires_id, condition)
EDGES = [
    # Shared
    ("passport", "cnic", None),
    ("hec_attestation", "bachelors_degree", None),
    ("hec_attestation", "bachelors_transcript", None),
    ("hec_attestation", "ibcc_equivalence", "needs_intermediate_equivalence"),
    ("police_character_certificate", "cnic", None),
    # UK
    ("tb_test_certificate", "passport", None),
    # USA
    ("ds160_confirmation", "passport", None),
    ("sevis_fee_receipt", "i20_form", None),
    # Canada
    ("pal_canada", "loa_canada", None),
    ("medical_exam_canada", "passport", None),
    ("biometrics_canada", "passport", None),
    # Australia
    ("health_exam_australia", "passport", None),
    ("biometrics_australia", "passport", None),
]


async def seed() -> None:
    # Ensure tables exist (dev convenience; production uses alembic).
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as db:
        for o in OFFICES:
            await db.merge(Office(last_verified_at=LAST_VERIFIED, **o))

        for d in DOCUMENTS:
            await db.merge(DocumentRef(
                last_verified_at=LAST_VERIFIED,
                source_url=d.get("official_url"),
                **d,
            ))

        # Edges have no inbound FKs — clear and reinsert for idempotency.
        await db.execute(delete(DocumentEdge))
        for document_id, requires_id, condition in EDGES:
            db.add(DocumentEdge(document_id=document_id, requires_id=requires_id, condition=condition))

        await db.commit()

    await engine.dispose()
    print(f"Seeded {len(OFFICES)} offices, {len(DOCUMENTS)} documents, {len(EDGES)} edges "
          f"across {len(ALL)} countries.")
    print("Remember: every value (incl. country_relevance) is a PLACEHOLDER — verify before launch.")


if __name__ == "__main__":
    asyncio.run(seed())
