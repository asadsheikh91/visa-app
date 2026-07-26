"""
student_visa.py

API routes for the Student Visa Readiness Checker.

GET  /api/visa/student/countries
GET  /api/visa/student/history
GET  /api/visa/student/{country}/questions    ?include_sources=false&include_rules=false
POST /api/visa/student/{country}/check
"""

import logging

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.base import AuthUser
from database import get_db
from limiter import limiter
from services.user_service import (
    get_or_create_user,
    get_user_by_auth_id,
    save_visa_check,
    get_user_checks,
    start_readiness_session,
    complete_readiness_session,
)
from services.entitlements import check_lifetime_cap
from models import VisaCheck

from services.visa_data_service import (
    get_available_countries,
    is_supported_country,
    load_questions,
    load_scoring,
    load_sources,
    load_rules,
    normalize_questions,
    resolve_sources,
    compute_required_missing,
    InvalidVisaTypeError,
    InvalidCountryError,
    DataNotFoundError,
    DataCorruptedError,
    StorageConfigError,
    StorageUnavailableError,
)
from services.readiness_engine import evaluate
from services.country_sources import get_country_meta

logger = logging.getLogger(__name__)
router = APIRouter()

VISA_TYPE = "student_visa"


class CheckRequest(BaseModel):
    answers: dict
    # Optional: the readiness session opened by POST /start, so the check can close
    # it (funnel/abandonment accounting). Omitting it still saves the check.
    session_id: str | None = None


# Free accounts get a fixed number of readiness checks for their whole lifetime.
# When they're out, the checker is closed (paid/admin are exempt). This message is
# shared by /start and /check so the copy stays consistent.
_CAP_MESSAGE = (
    "You've used all your free readiness checks. Upgrade to run more, or contact "
    "support if you need another attempt."
)


def _data_error_response(exc: Exception) -> JSONResponse | None:
    if isinstance(exc, (InvalidVisaTypeError, InvalidCountryError)):
        return JSONResponse(status_code=400, content={"error": str(exc)})
    if isinstance(exc, DataNotFoundError):
        return JSONResponse(status_code=404, content={"error": str(exc)})
    if isinstance(exc, DataCorruptedError):
        return JSONResponse(status_code=500, content={"error": str(exc)})
    if isinstance(exc, StorageConfigError):
        return JSONResponse(status_code=503, content={"error": "The readiness checker is temporarily unavailable. Please try again later."})
    if isinstance(exc, StorageUnavailableError):
        return JSONResponse(status_code=503, content={"error": "The readiness checker is temporarily unavailable. Please try again in a moment."})
    return None


# ---------------------------------------------------------------------------
# GET /countries
# ---------------------------------------------------------------------------

@router.get("/countries")
@limiter.limit("60/minute")
async def get_countries(request: Request, current_user: AuthUser = Depends(get_current_user)):
    try:
        countries = get_available_countries(VISA_TYPE)
        return JSONResponse(content=countries)
    except Exception as exc:
        mapped = _data_error_response(exc)
        if mapped is not None:
            return mapped
        return JSONResponse(status_code=500, content={"error": "Failed to load country list."})


# ---------------------------------------------------------------------------
# GET /{country}/meta  — official authority + last-reviewed date (Module D)
# ---------------------------------------------------------------------------

@router.get("/{country}/meta")
@limiter.limit("60/minute")
async def get_country_meta_route(
    request: Request,
    country: str,
    current_user: AuthUser = Depends(get_current_user),
):
    meta = get_country_meta(country)
    if meta is None:
        return JSONResponse(status_code=404, content={"error": "This country is not supported yet."})
    return JSONResponse(content=meta)


# ---------------------------------------------------------------------------
# GET /history
# ---------------------------------------------------------------------------

@router.get("/history")
@limiter.limit("30/minute")
async def get_history(
    request: Request,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the authenticated user's last 20 visa readiness checks, newest first."""
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        return JSONResponse(content=[])

    checks = await get_user_checks(db, db_user, limit=20)
    return JSONResponse(content=[
        {
            "id":                 str(check.id),
            "country":            check.country,
            "visa_type":          check.visa_type,
            "score":              check.score,
            "result":             check.result,
            "result_description": check.result_description or "",
            "critical_blockers":  check.critical_blockers,
            # Phase 4B: real persisted values; || default handles pre-migration NULLs
            "high_risk_flags":    check.high_risk_flags    or [],
            "soft_warnings":      check.soft_warnings      or [],
            "normalized_answers": check.normalized_answers or {},
            "sources_used":       check.sources_used       or [],
            "warnings":           check.warnings,
            "recommendations":    check.recommendations,
            "created_at":         check.created_at.isoformat(),
        }
        for check in checks
    ])


# ---------------------------------------------------------------------------
# POST /{country}/start  — open a session + enforce the lifetime cap up front
# ---------------------------------------------------------------------------

@router.post("/{country}/start")
@limiter.limit("20/minute")
async def start_check(
    request: Request,
    country: str,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Open a readiness session (for the funnel/abandonment KPI) and enforce the
    lifetime cap before the user answers anything. Over cap → 429. The cap is
    re-checked authoritatively at /check, so this endpoint is purely UX + tracking.
    """
    country = country.lower().strip()
    if not is_supported_country(VISA_TYPE, country):
        return JSONResponse(status_code=404, content={"error": "This country is not supported yet."})

    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        db_user = await get_or_create_user(db, current_user.user_id, current_user.email)

    allowed, used, limit = await check_lifetime_cap(db, db_user, "readiness_check", VisaCheck)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"error": _CAP_MESSAGE, "used": used, "limit": limit},
        )

    session = await start_readiness_session(db, db_user, country)
    remaining = None if limit is None else max(0, limit - used)
    return JSONResponse(content={
        "session_id": str(session.id),
        "remaining":  remaining,
        "limit":      limit,
    })


# ---------------------------------------------------------------------------
# GET /{country}/questions
# ---------------------------------------------------------------------------

@router.get("/{country}/questions")
@limiter.limit("30/minute")
async def get_questions(
    request: Request,
    country: str,
    current_user: AuthUser = Depends(get_current_user),
    include_sources: bool = Query(False, description="Resolve source_ids against sources.json"),
    include_rules:   bool = Query(False, description="Include rules.json in the response"),
):
    country = country.lower().strip()
    if not is_supported_country(VISA_TYPE, country):
        return JSONResponse(status_code=404, content={"error": "This country is not supported yet."})

    try:
        raw_questions = load_questions(VISA_TYPE, country)
        # Preflight the scoring data too. The check step needs scoring.json, and
        # in practice questions.json is often served from the cache while
        # scoring.json is fetched fresh — so an R2 outage can slip past this
        # questions load and only surface AFTER the applicant has answered every
        # question ("visa data not available"). Loading scoring here verifies R2
        # connectivity up front (and warms the cache), so we can tell the user the
        # checker is temporarily unavailable BEFORE they take the test.
        load_scoring(VISA_TYPE, country)
    except Exception as exc:
        mapped = _data_error_response(exc)
        if mapped is not None:
            return mapped
        import traceback; traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": "Failed to load visa questions."})

    # Normalise to canonical fields only
    questions = normalize_questions(raw_questions)

    # Source resolution: only load sources.json when the caller requests it.
    if include_sources:
        sources_data = None
        try:
            sources_data = load_sources(VISA_TYPE, country)
        except Exception:
            pass  # optional file — failure is non-fatal
        if sources_data is not None:
            questions = resolve_sources(questions, sources_data)

    response: dict = {
        "visa_type": VISA_TYPE,
        "country":   country,
        "questions": questions,
    }

    if include_rules:
        try:
            rules = load_rules(VISA_TYPE, country)
            response["rules"] = rules or []
        except Exception:
            response["rules"] = []

    return JSONResponse(content=response)


# ---------------------------------------------------------------------------
# POST /{country}/check
# ---------------------------------------------------------------------------

@router.post("/{country}/check")
@limiter.limit("10/minute")
async def check_readiness(
    request: Request,
    country: str,
    body: CheckRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    country = country.lower().strip()
    if not is_supported_country(VISA_TYPE, country):
        return JSONResponse(status_code=404, content={"error": "This country is not supported yet."})

    if not isinstance(body.answers, dict) or not body.answers:
        return JSONResponse(status_code=400, content={"error": "No answers provided."})

    # Load required data
    try:
        raw_questions = load_questions(VISA_TYPE, country)
        scoring       = load_scoring(VISA_TYPE, country)
    except Exception as exc:
        mapped = _data_error_response(exc)
        if mapped is not None:
            return mapped
        return JSONResponse(status_code=500, content={"error": "Failed to load visa data."})

    # Evaluate
    try:
        result = evaluate(raw_questions, scoring, body.answers)
    except (KeyError, TypeError, ValueError):
        import traceback; traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": "Visa scoring data is misconfigured for this country. Please try again later."})
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Failed to evaluate answers. Please try again."})

    # Required missing answers (show_if-aware)
    normalized_qs = normalize_questions(raw_questions)
    required_missing = compute_required_missing(normalized_qs, body.answers)

    # Resolve the user and enforce the lifetime cap authoritatively here — never
    # trust that /start ran. Done after evaluation so data/scoring errors keep their
    # own status codes; the cap still gates the save below.
    db_user = await get_user_by_auth_id(db, current_user.user_id)
    if db_user is None:
        db_user = await get_or_create_user(db, current_user.user_id, current_user.email)

    allowed, used, cap = await check_lifetime_cap(db, db_user, "readiness_check", VisaCheck)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"error": _CAP_MESSAGE, "used": used, "limit": cap},
        )

    # Persist — save_visa_check now stores the full engine result (Phase 4B).
    try:
        saved = await save_visa_check(db, db_user, country, VISA_TYPE, result)
        check_id = str(saved.id)
    except Exception:
        await db.rollback()
        logger.exception(
            "Failed to save visa check for auth_user_id=%s country=%s",
            current_user.user_id, country,
        )
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to save visa check. Please try again."},
        )

    # Close the funnel session (best-effort — never blocks the response).
    await complete_readiness_session(db, db_user, body.session_id, saved)

    # This check counts against the lifetime cap now that it's saved.
    remaining = None if cap is None else max(0, cap - (used + 1))

    return JSONResponse(content={
        "id":                       check_id,
        "visa_type":                VISA_TYPE,
        "country":                  country,
        "score":                    result["score"],
        "result":                   result["result"],
        "result_description":       result["result_description"],
        "critical_blockers":        result["critical_blockers"],
        "high_risk_flags":          result.get("high_risk_flags",    []),
        "soft_warnings":            result.get("soft_warnings",      []),
        "warnings":                 result["warnings"],
        "recommendations":          result["recommendations"],
        "normalized_answers":       result.get("normalized_answers", {}),
        "sources_used":             result.get("sources_used",       []),
        "required_missing_answers": required_missing,
        "checks_remaining":         remaining,
    })
