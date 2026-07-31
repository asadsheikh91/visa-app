import logging
import os
from contextlib import asynccontextmanager
from urllib.parse import urlsplit, urlunsplit
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from limiter import limiter
from observability import init_sentry
from routers import (
    student_visa, currency, profile, visa_file, action_plan, timeline, sop, interview,
    document_guidance, financial_document, trust, outcomes, journey, org, report,
    billing, admin,
)
from sqlalchemy import text
from fastapi.responses import JSONResponse

from database import engine, Base

load_dotenv()
logging.basicConfig(level=logging.INFO)

# Before anything else can raise: Sentry has to be initialised ahead of the app
# and its routers so that failures during startup are reported too, not just the
# ones that happen once traffic is being served. No-ops unless SENTRY_DSN is set.
init_sentry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception:
        logging.exception("Database initialization failed.")
        raise
    yield
    try:
        await engine.dispose()
    except Exception:
        pass


# Environment gate. Defaults to "development" so local/staging behaviour is
# unchanged; set ENVIRONMENT=production in the prod deployment.
_ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
_IS_PRODUCTION = _ENVIRONMENT == "production"

# Hard ceiling on request-body size, enforced before any route parses the body,
# to bound memory use and downstream (AI/DB) cost from oversized payloads. The
# API's largest legitimate bodies (an SOP, a manually-entered bank statement) are
# only tens of KB, so the 512 KB default has an enormous margin; override with
# MAX_REQUEST_BODY_BYTES if a future endpoint needs more.
_BODY_METHODS = {"POST", "PUT", "PATCH"}
try:
    _MAX_REQUEST_BODY_BYTES = int(os.getenv("MAX_REQUEST_BODY_BYTES", str(512 * 1024)))
except ValueError:
    _MAX_REQUEST_BODY_BYTES = 512 * 1024

# In production, disable the interactive API docs (Swagger /docs, ReDoc /redoc)
# AND the machine-readable schema (/openapi.json) so the full API surface isn't
# publicly enumerable. In dev/staging these stay at the FastAPI defaults
# (/docs, /redoc, /openapi.json) — behaviour is exactly as before.
_docs_kwargs: dict = (
    {"docs_url": None, "redoc_url": None, "openapi_url": None} if _IS_PRODUCTION else {}
)

app = FastAPI(
    title="ParchiVisa - Student Visa Readiness API",
    lifespan=lifespan,
    **_docs_kwargs,
)

# --- Rate limiting ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CORS ---
# Browsers treat `localhost` and `127.0.0.1` as DIFFERENT origins, so a page
# served on http://127.0.0.1:3000 is blocked when only http://localhost:3000 is
# allowed (and vice versa). In local dev the API URL and the app URL are often
# typed with different spellings of the loopback host, which silently breaks every
# authenticated request. To remove that foot-gun we keep the two in lockstep: if
# one loopback spelling is allowed, allow its twin too. Non-loopback origins
# (real domains, LAN IPs) are left exactly as configured.
def _with_loopback_twins(origins: list[str]) -> list[str]:
    twin = {"localhost": "127.0.0.1", "127.0.0.1": "localhost"}
    result: list[str] = []
    seen: set[str] = set()

    def _add(origin: str) -> None:
        if origin and origin not in seen:
            seen.add(origin)
            result.append(origin)

    for origin in origins:
        _add(origin)
        parts = urlsplit(origin)
        if parts.hostname in twin:
            netloc = twin[parts.hostname] + (f":{parts.port}" if parts.port else "")
            _add(urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment)))
    return result


_raw_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = _with_loopback_twins(
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# --- Security headers (applied app-wide, to EVERY response) ---
# Scope note: this is a JSON API. The Next.js frontend is a separate app/origin
# that loads its own assets (Google Fonts, the Clerk SDK); those belong in the
# FRONTEND's CSP, not here. This API serves no external scripts/fonts/styles of
# its own, so `default-src 'self'` needs NO allowlisted origins and breaks no API
# client (CSP governs how a *document* loads resources; JSON the frontend fetches
# is unaffected by this header).
#
# These headers are distinct from the CORS Access-Control-* headers above — no
# overlap or duplication; the two middlewares set non-conflicting header sets.
SECURITY_HEADERS = {
    # HSTS is honoured by browsers ONLY over HTTPS. In local dev the API is plain
    # http://127.0.0.1, where browsers IGNORE this header — so it is inert in dev
    # by browser design (NOT silently disabled by us), and begins enforcing once
    # the API is served over HTTPS in production.
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    # `frame-ancestors 'none'` is the modern equivalent of X-Frame-Options: DENY
    # (both sent for old+new browser coverage). `default-src 'self'` + object/base
    # hardening. No external origins needed — see the scope note above.
    "Content-Security-Policy": (
        "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
    ),
    "Referrer-Policy": "strict-origin-when-cross-origin",
}


def _apply_security_headers(response):
    # setdefault: never clobber a header a route deliberately set itself.
    for header, value in SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    return response


@app.middleware("http")
async def add_security_headers(request, call_next):
    # Reject oversized bodies up front — before the route buffers/parses them —
    # using the declared Content-Length. Requests without a Content-Length (rare
    # for JSON clients) fall through to the ASGI server's own stream limits. The
    # 413 is built here so it still carries the security headers below.
    if request.method in _BODY_METHODS:
        declared = request.headers.get("content-length")
        if declared is not None:
            try:
                oversized = int(declared) > _MAX_REQUEST_BODY_BYTES
            except ValueError:
                oversized = False
            if oversized:
                return _apply_security_headers(
                    JSONResponse(status_code=413, content={"error": "Request body too large."})
                )
    response = await call_next(request)
    return _apply_security_headers(response)


# --- Routers ---
app.include_router(student_visa.router, prefix="/api/visa/student", tags=["student-visa"])
app.include_router(currency.router, prefix="/currency", tags=["currency"])
app.include_router(profile.router, prefix="/api/user", tags=["profile"])
app.include_router(visa_file.router, prefix="/api/visa/file", tags=["visa-file"])
app.include_router(action_plan.router, prefix="/api/visa/action-plan", tags=["action-plan"])
app.include_router(timeline.router, prefix="/api/visa/timeline", tags=["timeline"])
app.include_router(sop.router, prefix="/api/visa/sop", tags=["sop-review"])
app.include_router(interview.router, prefix="/api/visa/interview", tags=["interview"])
app.include_router(document_guidance.router, prefix="/api/visa/documents", tags=["document-guidance"])
app.include_router(financial_document.router, prefix="/api/visa/documents/financial", tags=["financial-document"])
app.include_router(trust.router, prefix="/api/visa/trust", tags=["trust"])
app.include_router(outcomes.router, prefix="/api/visa/outcomes", tags=["outcomes"])
app.include_router(journey.router, prefix="/api/visa/journey", tags=["journey"])
app.include_router(org.router, prefix="/api/org", tags=["organization"])
app.include_router(report.router, prefix="/api/visa", tags=["readiness-report"])
app.include_router(billing.router, prefix="/api/billing", tags=["billing"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])


@app.get("/")
async def root():
    """Liveness: the process is up and serving."""
    return {"status": "ok", "service": "ParchiVisa API"}


@app.get("/health")
async def health():
    """
    Readiness: verifies the database is reachable. Returns 503 when it isn't, so
    platform health checks (Railway/Render/Fly) mark a deploy unhealthy instead
    of letting it serve 500s to users.
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        logging.exception("Health check failed: database unreachable.")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "unreachable"},
        )
    return {"status": "ok", "database": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
