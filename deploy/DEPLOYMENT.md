# Deploying ParchiVisa to a DigitalOcean Droplet

Single 2GB Droplet running Postgres + backend + frontend + Caddy (TLS), all via
Docker Compose. Everything lives on one box — no external managed services.

## 1. Create the Droplet

- Image: **Ubuntu 24.04 LTS**
- Plan: Basic, **2 GB RAM / 1 vCPU** (~$12/mo) — Playwright/Chromium needs the headroom
- Add a **Volume** (Block Storage) if you want Postgres data on separate, resizable
  disk instead of the Droplet's own disk — optional at this stage, skip it to start
- Add your SSH key at creation (don't use password auth)
- Region: closest to your users

## 2. Point DNS at it

At your domain registrar, add A records to the Droplet's IP:
- `parchivisa.com` → droplet IP
- `www.parchivisa.com` → droplet IP
- `api.parchivisa.com` → droplet IP

Caddy (already configured in [deploy/Caddyfile](Caddyfile)) auto-provisions Let's
Encrypt certs for all three the first time it starts, **as long as DNS has
propagated** — wait for `dig parchivisa.com` to return the droplet IP before
starting the stack.

## 3. Install Docker on the Droplet

```bash
ssh root@<droplet-ip>
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin
```

## 4. Clone the repo and configure env files

```bash
git clone <your-repo-url> /opt/parchivisa
cd /opt/parchivisa
```

Three env files needed, none of them committed to git:

**`.env`** (repo root — copy from [.env.prod.example](../.env.prod.example)):
```
POSTGRES_USER=parchivisa
POSTGRES_PASSWORD=<generate a strong random value>
POSTGRES_DB=parchivisa
NEXT_PUBLIC_API_URL=https://api.parchivisa.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
NEXT_PUBLIC_AI_TOOLS_ENABLED=false
NEXT_PUBLIC_AGENCY_ENABLED=false
```
`docker compose` auto-loads this file from the repo root, so no extra flags
needed. Generate the Postgres password with e.g. `openssl rand -base64 24`.

**`backend/.env`** — copy from `backend/.env.example` and fill in real values.
The important change from the example: point `DATABASE_URL` at the `postgres`
service by its Compose network hostname (not `localhost`, not a Supabase URL),
using the same credentials as the root `.env`:
```
DATABASE_URL=postgresql+asyncpg://parchivisa:<same-password-as-root-.env>@postgres:5432/parchivisa
ENVIRONMENT=production
CORS_ALLOWED_ORIGINS=https://parchivisa.com,https://www.parchivisa.com
REPORT_PRINT_BASE_URL=https://parchivisa.com
```
Plus real values for `CLERK_JWKS_URL`, `CLERK_SECRET_KEY`, `FIELD_ENCRYPTION_KEY`,
`R2_*`, and any of `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `GUMROAD_WEBHOOK_SECRET`
you're using. Leave `REDIS_URL` unset for now — it's optional.

**`frontend/.env.production`** — same `NEXT_PUBLIC_*` values as the root `.env`
(Next.js needs them at container runtime too, in addition to the build-time args
Compose passes in).

## 5. Build and start

```bash
cd /opt/parchivisa
docker compose -f docker-compose.prod.yml up -d --build
```

The backend entrypoint runs `alembic upgrade head` automatically before starting
uvicorn, so migrations run against the freshly-created Postgres container on
first boot, and safely no-op on every redeploy after that.

## 6. Verify

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy    # watch cert issuance
docker compose -f docker-compose.prod.yml logs -f backend  # watch migrations run
curl -I https://api.parchivisa.com/docs   # should 404 in production (docs disabled) — expected
curl -I https://parchivisa.com
```

## 7. Back up Postgres

Since Postgres now lives only on this Droplet, you own backups. Simplest
approach — a nightly `pg_dump` to a file, shipped off-box (e.g. to a DO Spaces
bucket or R2, since you already have R2 credentials configured):

```bash
# /opt/parchivisa/deploy/backup.sh
#!/bin/bash
set -e
docker exec parchivisa_postgres pg_dump -U parchivisa parchivisa | gzip > /opt/backups/parchivisa_$(date +%F).sql.gz
# then rclone/aws s3 cp /opt/backups/parchivisa_$(date +%F).sql.gz to R2/Spaces
find /opt/backups -mtime +14 -delete
```
Wire it up with `crontab -e`:
```
0 3 * * * /opt/parchivisa/deploy/backup.sh
```
This is the one piece you were getting for free with a managed DB — it's a
five-minute script, but don't skip it before you have real user data.

## 8. Redeploying after code changes

```bash
cd /opt/parchivisa
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Later, once you outgrow this

- Add DO Managed Redis and set `REDIS_URL` — no code changes needed, it's already optional.
- Move Postgres to a DO Managed Database once backup/failover ops become a burden — swap `DATABASE_URL`, nothing else changes since it's already a bog-standard Postgres URL.
- Move to App Platform or add a second Droplet + load balancer once a single 2GB box is the bottleneck.
