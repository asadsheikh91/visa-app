# Deploying ParchiVisa

## The live topology

| Component | Host | Trigger |
|---|---|---|
| Frontend (Next.js) | Vercel | push to `main` |
| Backend (FastAPI) | Coolify, on a DigitalOcean droplet | push to `main` |
| Redis | Coolify, same droplet | — |
| PostgreSQL | DigitalOcean Managed Database | — |

Domains: `parchivisa.app` (Vercel) and `api.parchivisa.app` (Coolify).

Both platforms watch the GitHub repository and redeploy automatically on push to
`main`. There is no build gate between a push and production.

## Frontend — Vercel

Vercel builds `frontend/`. Environment variables are set in the Vercel project, not in
this repository. `NEXT_PUBLIC_*` values are baked into the client bundle at build time,
so changing one requires a redeploy — not just a restart.

```
NEXT_PUBLIC_API_URL=https://api.parchivisa.app
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…
NEXT_PUBLIC_AI_TOOLS_ENABLED=false
NEXT_PUBLIC_AGENCY_ENABLED=false
NEXT_PUBLIC_GA_ID=G-B0H4PSVMBL
CLERK_SECRET_KEY=sk_live_…
```

`NEXT_PUBLIC_GA_ID` is the Google Analytics 4 measurement ID. It is deliberately not
committed to the repository — not because it is secret (measurement IDs are visible in
any visitor's page source) but because leaving it unset is what keeps local
development and Vercel preview deployments from writing into the production property.
Set it on the Production environment only. See `frontend/components/Analytics.tsx`.

## Backend — Coolify

Coolify builds `backend/Dockerfile`. The image installs Chromium through Playwright's
own installer, which is what makes the report PDF route work — and why the backend
needs real memory headroom.

Environment variables live in Coolify's configuration. The ones that change behaviour
when missing:

| Variable | Effect if unset |
|---|---|
| `DATABASE_URL` | Backend will not start |
| `CLERK_JWKS_URL`, `CLERK_SECRET_KEY`, `CLERK_ISSUER` | Authenticated routes reject |
| `CORS_ALLOWED_ORIGINS` | Defaults to `localhost:3000` — the live frontend is blocked |
| `ENVIRONMENT=production` | Swagger, ReDoc and the OpenAPI schema stay publicly exposed |
| `FIELD_ENCRYPTION_KEY` | Document PII encryption unavailable |
| `REPORT_PRINT_BASE_URL` | PDF rendering cannot resolve the print route |
| `ADMIN_EMAILS` | Admin panel inaccessible |
| `GUMROAD_WEBHOOK_SECRET` | Billing webhook disables itself (503) — fail-closed by design |
| `GEMINI_API_KEY` | Reports fall back to deterministic templated prose |
| `REDIS_URL` | Rate limits become per-process; cache falls back to in-memory |
| `SENTRY_DSN` | Error reporting disabled — 500s go to container logs only |

`SENTRY_DSN` is the only configuration Sentry needs; everything else is set in
`observability.py`. Do **not** paste Sentry's onboarding snippet into `main.py`:
their default sets `send_default_pii=True`, which would ship applicants'
nationality, funding source and previous-refusal answers to a third party on
every crash. Four guards there prevent that, and `tests/test_observability.py`
fails if any of them is removed.

## Migrations

`backend/docker-entrypoint.sh` runs `alembic upgrade head` before serving traffic, on
every container start. Alembic no-ops when the database is already at head.

**A push to `main` therefore runs a migration against production with no gate.** Every
migration in `backend/alembic/versions/` has a working `downgrade()`, but a downgrade
that drops a column still destroys the data in it. Point-in-time recovery on the
managed database is the backstop, but recovering that way means losing every write
made since the restore point — so treat a migration that drops or rewrites data as a
manual operation, not something that rides a normal deploy.

## Backups

Postgres is a DigitalOcean Managed Database, so backups are automatic: daily
snapshots plus point-in-time recovery within the retention window, taken and stored
by DigitalOcean rather than on the droplet. Nothing in this repository schedules or
manages them.

Two things this does *not* do for you:

1. **Restores are untested until you test one.** Recover to a scratch database once,
   so the procedure is familiar before it is urgent.
2. **Retention is finite.** Point-in-time recovery only reaches back as far as the
   plan's window — long enough to catch a bad deploy, not long enough to catch data
   loss you notice weeks later.

Redis holds only cache entries and rate-limit counters. It is not backed up and does
not need to be; losing it costs a cold cache and reset counters.

## Rollback

- **Frontend:** Vercel retains previous deployments; promote the last good one.
- **Backend:** redeploy the previous commit from Coolify.
- **Database:** covered by neither of the above. See Backups.

## Verifying a deploy

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://parchivisa.app/
curl -s -o /dev/null -w "%{http_code}\n" https://api.parchivisa.app/health
curl -s -o /dev/null -w "%{http_code}\n" https://api.parchivisa.app/docs   # 404 expected
```

`/docs` returning 404 is correct in production — interactive API documentation is
disabled when `ENVIRONMENT=production`.

## Legacy: the all-in-one droplet

`docker-compose.prod.yml` at the repository root describes a different topology —
frontend, backend, Postgres and Caddy on a single droplet behind Caddy-managed TLS.
**This is not the live deployment.** It is retained as a self-hosting path, and shares
the backend build context with the live setup. If you change how ParchiVisa is
deployed, change it deliberately; do not assume the Compose file reflects production.
