# Downloadable Readiness Report — operator guide

The report feature turns a completed student-visa readiness check into a branded,
downloadable PDF. Facts (score, band, per-criterion scores, findings, sources) come
only from the deterministic engine + curated policy registry; a schema-locked LLM
(Gemini) rewrites only the four per-finding prose fields, with a deterministic
fallback when Gemini is unavailable. The PDF is produced server-side by Playwright
rendering the same React print route, stored privately in R2, and handed out as a
short-lived signed URL.

## Architecture at a glance

```
readiness engine + curated policy  ─┐
                                    ├─ report_builder ─ Fernet-encrypt ─ reports table
Gemini narrator (schema-locked) ────┘        │
   └─ deterministic fallback                 └─ narration cached in Redis (PII-free)

GET /reports/{token}        → ReportData JSON (Clerk auth + owner + paid plan)
GET /reports/{token}/pdf    → mint render token → Playwright → private R2 → signed URL
GET /reports/{token}/render → Clerk-free, render-token-gated (Playwright only)
```

The **single** template lives in `frontend/components/report/` (`ReportDocument`);
both the on-screen route and the print route render it. There is no second template.

## See it without any setup (design preview)

Run the frontend dev server and open **`/report/preview`** — it renders the real
template from mock data (dev-only; 404s in production). Browser → Print → Save as PDF
gives you a PDF via the identical print CSS.

## Turning it on for real (end-to-end)

1. **Install deps + browser**
   ```
   cd backend
   pip install -r requirements.txt
   python -m playwright install chromium      # downloads the headless browser
   ```
2. **Environment** (`backend/.env`)
   - `FIELD_ENCRYPTION_KEY` — **required**; the report is refused (503) rather than
     stored as plaintext PII. Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
   - `GEMINI_API_KEY` — optional; without it, reports use deterministic fallback
     prose. Verify the current Flash model id and set `GEMINI_MODEL` if needed.
   - `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (+ optional
     `R2_REPORTS_PREFIX` / `R2_REPORTS_BUCKET`) — required for PDF download.
   - `REPORT_PRINT_BASE_URL` — the frontend origin Playwright loads (prod URL).
   - `REDIS_URL` — optional; caches narration + render tokens across instances.
3. **Migrate**: `alembic upgrade head` (creates the `reports` table, revision
   `d6e7f8a9b0c1`). (In dev, `Base.metadata.create_all` also creates it on boot.)
4. **Grant access**: report generation/download requires a paid plan. Either set a
   test user's `plan` to `pro` directly, or wire Gumroad (below).
5. **Use it**: on the dashboard's *Previous checks*, click **Get readiness report**
   on any check → it generates and opens `/report/{token}` → **Download PDF**.

## Billing (Gumroad → plan)

Set `GUMROAD_WEBHOOK_SECRET` and point a Gumroad Ping at:
```
https://<api-host>/api/billing/gumroad/webhook?secret=<GUMROAD_WEBHOOK_SECRET>
```
A sale sets the buyer's `User.plan` to `GUMROAD_PLAN` (default `pro`); a refund/
dispute/cancellation reverts it to `free`. Purchases made **before** signup
pre-provision an email-only user row, which is claimed on first Clerk login. Without
a configured secret the webhook is disabled (503), so it can never be an open grant.
Optionally restrict with `GUMROAD_SELLER_ID` / `GUMROAD_PRODUCT_ID`.

## What to sanity-check on the first real run

- The applicant/criteria/verdict reflect the actual check (not placeholders).
- With `GEMINI_API_KEY` set, `narratedByAi` is `true`; kill the key and confirm the
  report still generates (fallback prose, `narratedByAi: false`).
- The PDF paginates cleanly on A4 with no cut finding cards and intact fonts.
- The signed R2 URL 200s immediately and 403s after ~5 minutes.

## Deliberate follow-ups (not bugs)

- **policyContext is a curated stand-in**, not a live RAG layer: it draws real,
  dated, source-linked excerpts from `services/country_sources` (authority +
  `RULE_CHANGELOG`). Swapping in true retrieval is isolated to
  `report_builder._policy_context` — nothing else changes. Kept curated on purpose
  until real Gemini output shows the grounding is too thin.
- **Verify the Gemini Flash model id** (`GEMINI_MODEL`) against current docs before
  production.
- **Self-hosting the report fonts** (Source Serif 4 / JetBrains Mono / Inter) would
  make PDF rendering fully deterministic offline. The render already never *hangs*
  on a blocked font CDN (it waits on `body[data-report-ready]`, which the print page
  sets after `document.fonts.ready` settles, bounded by a 2.5s ceiling), but the
  typefaces only appear if the CDN is reachable at render time.
```
