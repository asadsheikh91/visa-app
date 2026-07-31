# ParchiVisa

Student-visa readiness checks for applicants to the UK, Canada, Australia and the USA.
Live at **[parchivisa.app](https://parchivisa.app)**.

Most students learn their application was weak from the refusal letter — after the fee
is gone and the intake is missed. ParchiVisa assesses a file against published
government criteria *before* it is lodged, and returns a readiness score, the specific
issues that would sink it, and the order to fix them in.

---

## The central engineering constraint

**The score is computed, not generated.** Scoring is deterministic: the same answers
always produce the same verdict, and every finding traces back to a published rule in
the policy registry. A language model is used in exactly one place — rewriting four
per-finding prose fields in the readiness report — behind a locked response schema. It
cannot originate a fact, introduce a figure, or influence whether an applicant passes.

This is a product claim as much as a technical one, so it is enforced structurally
rather than by convention:

- `services/readiness_engine.py` owns scoring; it has no LLM dependency at all
- `services/gemini_narrator.py` is schema-locked and falls back to deterministic
  templated prose (`services/narration_fallback.py`) when the API key is absent or the
  call fails — report generation never hard-depends on a live model
- Band mapping is single-source: a cap caps the score, and `band_for_score` is pure
  mapping, so a score and its label can't disagree

## Architecture

```
Next.js 14 (App Router, TypeScript, Tailwind)     →  Vercel
        │  Clerk-authenticated, JSON over HTTPS
        ▼
FastAPI (async SQLAlchemy 2.0, Python 3.12)       →  Coolify, on a DO droplet
        ├── PostgreSQL     ·  DO Managed Database · Alembic migrations
        ├── Redis          ·  cache + cross-worker rate-limit counters (optional)
        ├── Cloudflare R2  ·  versioned country rule data
        ├── Gemini         ·  report narration only, schema-locked
        └── Playwright     ·  server-side A4 PDF rendering
```

Both Redis and Playwright degrade rather than fail: without Redis the limiter falls
back to per-process counters, and without Chromium the PDF route returns 503 while the
on-screen report keeps working.

## Engineering decisions worth reading

| Concern | Approach |
|---|---|
| Quota bypass via parallel requests | The check-then-insert on usage caps is a TOCTOU pair. A Postgres transaction-scoped advisory lock keyed on `(user, feature)` serialises it, so a burst can't all read "under limit". See `services/entitlements.py`. |
| Rate-limit evasion | Limits key on the verified Clerk user ID, not the IP — rotating IPs doesn't multiply an account's allowance. Falls back to IP only for unauthenticated liveness routes. |
| PII at rest | Extracted document fields are encrypted at the column level (`services/encryption.py`). No passport numbers are collected at any point. |
| Unsigned payment webhooks | Gumroad pings aren't signed, so a shared secret is required and compared in constant time; without it configured the endpoint disables itself (503) rather than becoming an open plan-grant. |
| Interactive API docs | Swagger, ReDoc and the OpenAPI schema are disabled when `ENVIRONMENT=production`. |
| Report link sharing | Reports are addressed by unguessable token, with separate short-lived render tokens for the PDF pipeline. |

## Repository layout

```
backend/     FastAPI service
  routers/     HTTP surface, one module per feature area
  services/    Business logic — engines, policy registry, integrations
  alembic/     17 migrations, all with working downgrades
  tests/       1,305 tests
frontend/    Next.js application
  app/         App Router routes
  components/  UI, organised by feature; `paper/` is the design system
  __tests__/   Component and behaviour tests
docs/        Feature and operator documentation
deploy/      Deployment notes
```

## Running locally

Requires Python 3.12+, Node 18+, and a PostgreSQL instance.

```bash
cd backend && python -m venv .venv && ./.venv/Scripts/activate && pip install -r requirements-dev.txt
```

```bash
cd backend && cp .env.example .env && alembic upgrade head && uvicorn main:app --reload
```

```bash
cd frontend && npm install && npm run dev
```

On Windows the frontend must point at `http://127.0.0.1:8000` rather than `localhost` —
the backend binds IPv4 only, and Node resolves `localhost` to `::1` first.

## Tests

```bash
cd backend && ./.venv/Scripts/python.exe -m pytest -q
```

```bash
cd frontend && npx jest && npx tsc --noEmit
```

## Deployment

Frontend deploys to Vercel and the backend to Coolify on a DigitalOcean droplet, both
on push to `main`. Postgres is a DigitalOcean Managed Database; Redis runs alongside
the backend in Coolify. Alembic migrations run on container start via
`backend/docker-entrypoint.sh`.

See [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md) for the full topology and the
environment variables each platform needs.

## Scope

Live: the readiness checker and the downloadable readiness report, for four
destination countries.

Built but intentionally dark behind feature flags: SOP review and mock interview
(`NEXT_PUBLIC_AI_TOOLS_ENABLED`), and the consultant/agency workspace
(`NEXT_PUBLIC_AGENCY_ENABLED`).

## Disclaimer

ParchiVisa is not an immigration agent and not a law firm. It does not file
applications, does not represent applicants, and does not promise visa outcomes.
