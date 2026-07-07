"""
visa_file_service.py

Persistence + serialization for the Visa File Builder.

  - fetch_or_create_file: one VisaFile per (user, visa_check). If a file already
    exists for that check, it is returned as-is so the user's status edits are
    preserved; otherwise the checklist engine generates a fresh one.
  - update_item_status: set a single checklist item's status.
  - serialize_file: derive category progress + completion stats + next actions
    from the stored items (never persisted — always computed fresh).

The checklist *rules* live in checklist_engine; this module only handles state.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, VisaCheck, VisaFile, UserVisaProfile
from services.checklist_engine import (
    build_checklist,
    category_meta,
    sort_items,
    CATEGORY_LABELS,
    CATEGORY_ORDER,
    VALID_STATUSES,
    DEFAULT_STATUS,
    RESOLVED_STATUSES,
)
from services.sponsor_evidence_engine import SUPERSEDED_ITEM_IDS as SPONSOR_SUPERSEDED

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------------------------------------------------------------------------
# Profile / check → plain dicts for the engine
# ---------------------------------------------------------------------------

def _profile_to_dict(profile: UserVisaProfile | None) -> dict:
    if profile is None:
        return {}
    return {
        "primary_country":      profile.primary_country,
        "funding_source":       profile.funding_source,
        "sponsor_relationship": profile.sponsor_relationship,
        "previous_refusal":     profile.previous_refusal,
        "study_gap":            profile.study_gap,
        "dependants":           profile.dependants,
        "study_level":          profile.study_level,
        "admission_status":     profile.admission_status,
    }


def _check_to_dict(check: VisaCheck | None) -> dict | None:
    if check is None:
        return None
    return {
        "country":           check.country,
        "score":             check.score,
        "result":            check.result,
        "critical_blockers": check.critical_blockers or [],
        "high_risk_flags":   check.high_risk_flags   or [],
        "soft_warnings":     check.soft_warnings      or [],
    }


# ---------------------------------------------------------------------------
# Item generation with status applied
# ---------------------------------------------------------------------------

def _generate_items(profile: UserVisaProfile | None, check: VisaCheck | None,
                    country: str, previous: list[dict] | None = None) -> list[dict]:
    """
    Build the checklist for (profile, check, country) and attach a status to each
    item. If `previous` items are supplied, their statuses are carried over for
    items that still exist (so a regeneration never loses the user's edits).
    """
    prev_status: dict[str, str] = {}
    for it in (previous or []):
        iid = it.get("id")
        st  = it.get("status")
        if iid and st in VALID_STATUSES:
            prev_status[iid] = st

    base = build_checklist(_profile_to_dict(profile), _check_to_dict(check), country)
    items: list[dict] = []
    for it in base:
        it = dict(it)
        it["status"] = prev_status.get(it["id"], DEFAULT_STATUS)
        items.append(it)
    return items


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

async def get_file_by_check(db: AsyncSession, user: User, visa_check_id) -> VisaFile | None:
    result = await db.execute(
        select(VisaFile).where(
            VisaFile.user_id == user.id,
            VisaFile.visa_check_id == visa_check_id,
        )
    )
    return result.scalar_one_or_none()


async def get_latest_file(db: AsyncSession, user: User) -> VisaFile | None:
    result = await db.execute(
        select(VisaFile)
        .where(VisaFile.user_id == user.id)
        .order_by(VisaFile.updated_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_file_by_id(db: AsyncSession, user: User, file_id) -> VisaFile | None:
    result = await db.execute(
        select(VisaFile).where(
            VisaFile.id == file_id,
            VisaFile.user_id == user.id,
        )
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Mutations
# ---------------------------------------------------------------------------

async def fetch_or_create_file(
    db: AsyncSession,
    user: User,
    check: VisaCheck,
    profile: UserVisaProfile | None,
) -> VisaFile:
    """
    Return the existing file for this check (preserving the user's edits) or
    generate a new one from the checklist engine.
    """
    existing = await get_file_by_check(db, user, check.id)
    if existing is not None:
        return existing

    items = _generate_items(profile, check, check.country)
    now = _utc_now()
    file = VisaFile(
        user_id=user.id,
        visa_check_id=check.id,
        country=check.country,
        visa_type=check.visa_type or "student_visa",
        items=items,
        created_at=now,
        updated_at=now,
    )
    db.add(file)
    await db.commit()
    await db.refresh(file)
    logger.info("Generated visa file %s for user=%s check=%s (%d items)",
                file.id, user.id, check.id, len(items))
    return file


async def update_item_status(
    db: AsyncSession, file: VisaFile, item_id: str, status: str
) -> VisaFile:
    """Set one checklist item's status. Raises ValueError on a bad status/id."""
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status '{status}'.")

    items = list(file.items or [])
    found = False
    new_items = []
    for it in items:
        if it.get("id") == item_id:
            it = dict(it)
            it["status"] = status
            found = True
        new_items.append(it)

    if not found:
        raise ValueError(f"Checklist item '{item_id}' not found in this file.")

    # Reassign so SQLAlchemy detects the JSON change.
    file.items = new_items
    file.updated_at = _utc_now()
    await db.commit()
    await db.refresh(file)
    return file


# ---------------------------------------------------------------------------
# Financial Proof integration
# ---------------------------------------------------------------------------

async def apply_financial_proof(
    db: AsyncSession,
    file: VisaFile,
    fp_inputs: dict,
    fp_result: dict,
) -> VisaFile:
    """
    Merge a Financial Proof Checker evaluation into a VisaFile:
      1. Strip any existing fin_* items (stale from a previous assessment).
      2. Append the fresh fin_* injections from the engine (status = DEFAULT_STATUS).
      3. Re-sort the whole checklist in canonical order.
      4. Persist the financial_proof blob (inputs + result).
    """
    non_fin = [it for it in (file.items or []) if not it.get("id", "").startswith("fin_")]

    for it in fp_result.get("checklist_injections", []):
        it = dict(it)
        it["status"] = DEFAULT_STATUS
        non_fin.append(it)

    file.items          = sort_items(non_fin)
    file.financial_proof = {"inputs": fp_inputs, "result": fp_result}
    file.updated_at     = _utc_now()

    await db.commit()
    await db.refresh(file)
    logger.info("Applied financial proof to visa file %s (%d items total)", file.id, len(file.items))
    return file


async def apply_sponsor_evidence(
    db: AsyncSession,
    file: VisaFile,
    sp_inputs: dict,
    sp_result: dict,
) -> VisaFile:
    """
    Merge a Sponsor Evidence Module evaluation into a VisaFile:
      1. Strip existing spn_* items (stale from a previous run).
      2. Strip the generic sponsor_* items generated by the checklist engine
         and fin_sponsor_income_proof from the financial proof checker —
         the richer spn_* items supersede all of these.
      3. Append fresh spn_* injections (status = DEFAULT_STATUS).
      4. Re-sort and persist.
    """
    kept = [
        it for it in (file.items or [])
        if not it.get("id", "").startswith("spn_")
        and it.get("id") not in SPONSOR_SUPERSEDED
    ]

    for it in sp_result.get("checklist_injections", []):
        it = dict(it)
        it["status"] = DEFAULT_STATUS
        kept.append(it)

    file.items           = sort_items(kept)
    file.sponsor_evidence = {
        "inputs":   sp_inputs,
        "warnings": sp_result.get("warnings", []),
    }
    file.updated_at = _utc_now()

    await db.commit()
    await db.refresh(file)
    logger.info("Applied sponsor evidence to visa file %s (%d items total)", file.id, len(file.items))
    return file


# ---------------------------------------------------------------------------
# Serialization (derives categories + stats + next actions)
# ---------------------------------------------------------------------------

def _compute_categories(items: list[dict]) -> list[dict]:
    buckets: dict[str, dict] = {}
    for it in items:
        cat = it.get("category", "story")
        b = buckets.setdefault(cat, {"total": 0, "completed": 0, "critical": 0, "critical_missing": 0})
        b["total"] += 1
        resolved = it.get("status") in RESOLVED_STATUSES
        if resolved:
            b["completed"] += 1
        if it.get("priority") == "critical":
            b["critical"] += 1
            if not resolved:
                b["critical_missing"] += 1

    out = []
    for key in CATEGORY_ORDER:
        if key not in buckets:
            continue
        b = buckets[key]
        out.append({
            "key":              key,
            "label":            CATEGORY_LABELS[key],
            "total":            b["total"],
            "completed":        b["completed"],
            "critical":         b["critical"],
            "critical_missing": b["critical_missing"],
        })
    return out


def _compute_stats(items: list[dict]) -> dict:
    total = len(items)
    completed = sum(1 for it in items if it.get("status") in RESOLVED_STATUSES)
    critical_total = sum(1 for it in items if it.get("priority") == "critical")
    critical_missing = sum(
        1 for it in items
        if it.get("priority") == "critical" and it.get("status") not in RESOLVED_STATUSES
    )
    missing_total = total - completed
    completion_pct = round(completed / total * 100) if total else 0
    return {
        "total_items":      total,
        "completed":        completed,
        "missing_total":    missing_total,
        "critical_total":   critical_total,
        "critical_missing": critical_missing,
        "completion_pct":   completion_pct,
    }


def _next_actions(items: list[dict], stats: dict) -> list[str]:
    actions: list[str] = []

    if stats["total_items"] == 0:
        return ["Generate your visa file to see what's needed."]

    if stats["completion_pct"] >= 100:
        return ["Your file is complete — review every document once more before you apply."]

    # Surface outstanding critical items first.
    critical_missing = [
        it for it in items
        if it.get("priority") == "critical" and it.get("status") not in RESOLVED_STATUSES
    ]
    if critical_missing:
        actions.append(
            f"Resolve {len(critical_missing)} critical item"
            f"{'s' if len(critical_missing) != 1 else ''} still outstanding."
        )
        for it in critical_missing[:3]:
            actions.append(f"Prepare: {it['title']}.")
    else:
        actions.append("All critical items are handled — work through the remaining documents.")

    return actions


def serialize_file(file: VisaFile) -> dict:
    items = list(file.items or [])
    stats = _compute_stats(items)
    return {
        "id":              str(file.id),
        "visa_check_id":   str(file.visa_check_id) if file.visa_check_id else None,
        "country":         file.country,
        "visa_type":       file.visa_type,
        "items":           items,
        "categories":      _compute_categories(items),
        "category_meta":   category_meta(),
        "stats":           stats,
        "next_actions":    _next_actions(items, stats),
        "financial_proof":  file.financial_proof,    # None for pre-Sprint-2 files
        "sponsor_evidence": file.sponsor_evidence,  # None when not sponsor-funded
        "created_at":      file.created_at.isoformat(),
        "updated_at":      file.updated_at.isoformat(),
    }
