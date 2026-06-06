"""
visa_data_service.py

Fetches and caches visa JSON data from Cloudflare R2.
- All access is credential-based (private bucket).
- Validates visa type and country against strict allowlists.
- Prevents path traversal -- country/type are checked before any key is built.
- Never exposes R2 keys or bucket internals in raised exceptions.
- Cache: Redis (primary). Falls through to direct R2 fetch if Redis is
  unavailable -- graceful degradation, never an error.
- Optional files (sources.json, rules.json, blockers.json) are fetched with
  load_optional_json(); they return None rather than raising on 404.
"""

import json
import os
from typing import Any

import boto3
import redis as _redis
from botocore.config import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError

# ---------------------------------------------------------------------------
# Allowlists
# ---------------------------------------------------------------------------

ALLOWED_VISA_TYPES: set[str] = {"student_visa"}

ALLOWED_COUNTRIES: dict[str, list[str]] = {
    "student_visa": ["uk", "usa", "canada", "australia"],
}

VISA_TYPE_FOLDER: dict[str, str] = {
    "student_visa": "student",
}

COUNTRY_META: dict[str, dict[str, str]] = {
    "uk":        {"country": "United Kingdom", "slug": "uk",        "visa_route": "Student Visa"},
    "usa":       {"country": "United States",  "slug": "usa",       "visa_route": "F-1 Student Visa"},
    "canada":    {"country": "Canada",         "slug": "canada",    "visa_route": "Study Permit"},
    "australia": {"country": "Australia",      "slug": "australia", "visa_route": "Student Visa Subclass 500"},
}

# Canonical question fields the API exposes (all others are stripped on the way out)
CANONICAL_QUESTION_FIELDS: frozenset[str] = frozenset({
    "id", "question", "help_text", "input_type", "options", "required",
    "scoring_key", "risk_category", "validation", "show_if",
    "normalized_answer_format", "error_message", "blocker_possible",
    "source_url", "source_ids",
    # keep section/country/visa_route for display grouping in the frontend
    "section", "country", "visa_route",
})

# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------

class InvalidVisaTypeError(ValueError):
    def __init__(self) -> None:
        super().__init__("Invalid visa type.")

class InvalidCountryError(ValueError):
    def __init__(self) -> None:
        super().__init__("Invalid country selected.")

class DataNotFoundError(FileNotFoundError):
    def __init__(self, message: str = "Visa data not found for this country.") -> None:
        super().__init__(message)

class DataCorruptedError(ValueError):
    def __init__(self) -> None:
        super().__init__("Visa data is malformed.")

class StorageConfigError(RuntimeError):
    def __init__(self, missing: list[str]) -> None:
        self.missing = missing
        super().__init__(
            "Document storage is not configured. "
            f"Missing environment variable(s): {', '.join(missing)}."
        )

class StorageUnavailableError(RuntimeError):
    def __init__(self, message: str = "Document storage is temporarily unavailable.") -> None:
        super().__init__(message)

# ---------------------------------------------------------------------------
# R2 client
# ---------------------------------------------------------------------------

_REQUIRED_R2_ENV = ("R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")

_BOTO_CONFIG = BotoConfig(
    connect_timeout=5,
    read_timeout=10,
    retries={"max_attempts": 2, "mode": "standard"},
)


def _require_r2_env() -> dict[str, str]:
    missing = [name for name in _REQUIRED_R2_ENV if not os.environ.get(name)]
    if missing:
        raise StorageConfigError(missing)
    return {name: os.environ[name] for name in _REQUIRED_R2_ENV}


def _get_r2_client() -> Any:
    env = _require_r2_env()
    return boto3.client(
        "s3",
        endpoint_url=env["R2_ENDPOINT_URL"],
        aws_access_key_id=env["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=_BOTO_CONFIG,
    )

_BUCKET = lambda: os.environ.get("R2_BUCKET_NAME", "visa-app")
_PREFIX = lambda: os.environ.get("R2_PREFIX", "parchivisa-data")

# ---------------------------------------------------------------------------
# Redis cache
# ---------------------------------------------------------------------------

_CACHE_TTL = 3600  # 1 hour
_redis_client = None


def _get_redis():
    """
    Lazy singleton Redis client.
    Returns None (never raises) if Redis is not configured or unreachable.
    The caller falls back to a direct R2 fetch transparently.
    """
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        return None

    try:
        client = _redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        _redis_client = client
        return client
    except Exception:
        return None


def _cache_get(key: str) -> Any | None:
    client = _get_redis()
    if client is None:
        return None
    try:
        raw = client.get(key)
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return None


def _cache_set(key: str, data: Any) -> None:
    client = _get_redis()
    if client is None:
        return
    try:
        client.setex(key, _CACHE_TTL, json.dumps(data))
    except Exception:
        pass  # Cache write failure is non-fatal

# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def _validate_visa_type(visa_type: str) -> None:
    if visa_type not in ALLOWED_VISA_TYPES:
        raise InvalidVisaTypeError()

def _validate_country(visa_type: str, country: str) -> None:
    if country not in ALLOWED_COUNTRIES.get(visa_type, []):
        raise InvalidCountryError()

# ---------------------------------------------------------------------------
# Core R2 fetch
# ---------------------------------------------------------------------------

def _build_key(visa_type: str, country: str, filename: str) -> str:
    folder = VISA_TYPE_FOLDER[visa_type]
    return f"{_PREFIX()}/{folder}/{country}/{filename}"


def _fetch_json(r2_key: str) -> Any:
    """Fetch a required file. Raises DataNotFoundError if missing."""
    cached = _cache_get(r2_key)
    if cached is not None:
        return cached

    client = _get_r2_client()

    try:
        response = client.get_object(Bucket=_BUCKET(), Key=r2_key)
        raw = response["Body"].read().decode("utf-8")
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code in ("NoSuchKey", "NoSuchBucket", "404"):
            raise DataNotFoundError()
        raise StorageUnavailableError("Failed to read visa data from storage.")
    except BotoCoreError:
        raise StorageUnavailableError()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise DataCorruptedError()

    _cache_set(r2_key, data)
    return data


def _fetch_optional_json(r2_key: str) -> Any | None:
    """
    Fetch an optional file. Returns None if the file does not exist (404).
    Raises StorageUnavailableError on connectivity problems.
    Raises DataCorruptedError if the file exists but is malformed JSON.
    """
    cached = _cache_get(r2_key)
    if cached is not None:
        return cached

    client = _get_r2_client()

    try:
        response = client.get_object(Bucket=_BUCKET(), Key=r2_key)
        raw = response["Body"].read().decode("utf-8")
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code in ("NoSuchKey", "NoSuchBucket", "404"):
            return None
        raise StorageUnavailableError("Failed to read optional visa data from storage.")
    except BotoCoreError:
        raise StorageUnavailableError()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise DataCorruptedError()

    _cache_set(r2_key, data)
    return data

# ---------------------------------------------------------------------------
# Question normalisation
# ---------------------------------------------------------------------------

def normalize_question(raw: dict) -> dict:
    """
    Returns a question dict containing only canonical API fields.
    Maps old field names to canonical ones, then strips everything else.

    Old -> canonical:
      question_id   -> id
      question_text -> question
      user_help_text-> help_text

    Any field not in CANONICAL_QUESTION_FIELDS is dropped silently.
    """
    q: dict = {}

    # id
    q["id"] = raw.get("id") or raw.get("question_id") or ""

    # question
    q["question"] = raw.get("question") or raw.get("question_text") or ""

    # help_text
    q["help_text"] = raw.get("help_text") or raw.get("user_help_text") or ""

    # copy remaining canonical fields directly
    for field in CANONICAL_QUESTION_FIELDS - {"id", "question", "help_text"}:
        if field in raw:
            q[field] = raw[field]

    return q


def normalize_questions(raw_questions: list) -> list:
    """Normalises a list of raw question dicts. Non-dict entries are dropped."""
    if not isinstance(raw_questions, list):
        return []
    return [normalize_question(q) for q in raw_questions if isinstance(q, dict)]

# ---------------------------------------------------------------------------
# Source resolution
# ---------------------------------------------------------------------------

def resolve_sources(questions: list, sources_data: dict | None) -> list:
    """
    Enriches question dicts with resolved_sources when sources.json is available.

    For each question that has source_ids:
      - Look up each ID in sources_data["sources"]
      - Add resolved_sources: list of {source_id, name, url} objects
      - Add unresolved_source_ids: list of IDs that could not be resolved
    Questions without source_ids are returned unchanged.

    If sources_data is None, questions are returned unchanged.
    """
    if not sources_data or not isinstance(sources_data, dict):
        return questions

    source_map: dict = sources_data.get("sources", {})

    result = []
    for q in questions:
        sids = q.get("source_ids") or []
        if not sids:
            result.append(q)
            continue

        resolved = []
        unresolved = []
        for sid in sids:
            src = source_map.get(sid)
            if src:
                resolved.append({"source_id": sid, **src})
            else:
                unresolved.append(sid)

        q_out = dict(q)
        if resolved:
            q_out["resolved_sources"] = resolved
        if unresolved:
            q_out["unresolved_source_ids"] = unresolved

        result.append(q_out)

    return result

# ---------------------------------------------------------------------------
# show_if evaluator (for required_missing_answers)
# ---------------------------------------------------------------------------

def _evaluate_show_if(show_if: dict | None, answers: dict) -> bool:
    """
    Returns True if the question should be shown given the current answers.
    Returns True for null show_if (always visible).
    Returns False if the condition is not met (question is hidden).
    Does not raise -- returns True on malformed conditions (conservative: show).
    """
    if show_if is None:
        return True
    if not isinstance(show_if, dict):
        return True  # malformed: show conservatively

    op = show_if.get("operator") or show_if.get("type", "")

    if op in ("and", "or"):
        subs = show_if.get("conditions", [])
        results = [_evaluate_show_if(sub, answers) for sub in subs]
        return all(results) if op == "and" else any(results)

    ref_qid = show_if.get("question_id")
    if not ref_qid:
        return True

    answer = answers.get(ref_qid)
    value  = show_if.get("value")

    if op == "eq":
        if answer is None:
            return False
        return str(answer).strip().lower() == str(value).strip().lower()

    if op == "neq":
        if answer is None:
            return False
        return str(answer).strip().lower() != str(value).strip().lower()

    if op == "in":
        if answer is None or not isinstance(value, list):
            return False
        return str(answer).strip().lower() in {str(v).strip().lower() for v in value}

    if op == "not_in":
        if answer is None or not isinstance(value, list):
            return True  # no answer = not in the list = show
        return str(answer).strip().lower() not in {str(v).strip().lower() for v in value}

    if op == "multi_contains":
        # Parent question is multi_choice; show if parent answer contains value
        if answer is None:
            return False
        if isinstance(answer, list):
            items = [str(a).strip().lower() for a in answer]
        elif "," in str(answer):
            items = [v.strip().lower() for v in str(answer).split(",")]
        else:
            items = [str(answer).strip().lower()]
        return str(value).strip().lower() in items

    return True  # unknown operator: show conservatively


def compute_required_missing(questions: list, answers: dict) -> list[str]:
    """
    Returns the list of question IDs that are:
      - required=True
      - visible (show_if evaluates to True given current answers)
      - not answered (answer is None, "", or absent)

    Questions that are hidden by show_if are excluded even if required=True,
    because they are not applicable to the applicant's path.
    """
    missing = []
    for q in questions:
        if not isinstance(q, dict):
            continue
        if not q.get("required"):
            continue
        qid = q.get("id") or q.get("question_id") or ""
        if not qid:
            continue

        # Check visibility
        if not _evaluate_show_if(q.get("show_if"), answers):
            continue

        # Check answer
        answer = answers.get(qid)
        if answer is None or answer == "" or answer == []:
            missing.append(qid)

    return missing

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def is_supported_country(visa_type: str, country: str) -> bool:
    return country in ALLOWED_COUNTRIES.get(visa_type, [])


def get_available_countries(visa_type: str) -> list[dict[str, str]]:
    _validate_visa_type(visa_type)
    slugs = ALLOWED_COUNTRIES[visa_type]
    return [COUNTRY_META[s] for s in slugs if s in COUNTRY_META]


def load_questions(visa_type: str, country: str) -> Any:
    _validate_visa_type(visa_type)
    _validate_country(visa_type, country)
    return _fetch_json(_build_key(visa_type, country, "questions.json"))


def load_scoring(visa_type: str, country: str) -> Any:
    _validate_visa_type(visa_type)
    _validate_country(visa_type, country)
    return _fetch_json(_build_key(visa_type, country, "scoring.json"))


def load_rules(visa_type: str, country: str) -> Any | None:
    """Returns rules or None if not found (optional file)."""
    _validate_visa_type(visa_type)
    _validate_country(visa_type, country)
    return _fetch_optional_json(_build_key(visa_type, country, "rules.json"))


def load_sources(visa_type: str, country: str) -> Any | None:
    """
    Returns sources.json contents or None if the country has no sources file.
    Currently only USA has sources.json; other countries return None safely.
    """
    _validate_visa_type(visa_type)
    _validate_country(visa_type, country)
    return _fetch_optional_json(_build_key(visa_type, country, "sources.json"))


def load_blockers(visa_type: str, country: str) -> Any | None:
    """Returns blockers.json or None (optional; scoring.json is the primary source)."""
    _validate_visa_type(visa_type)
    _validate_country(visa_type, country)
    return _fetch_optional_json(_build_key(visa_type, country, "blockers.json"))
