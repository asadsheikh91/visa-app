# Student Visa Checker — Audit, Fixes & Testing

Date: 2026-06-03

This document covers what was broken, what changed, the files touched, how to test
the full flow, and the remaining risks/assumptions.

---

## 1. What was broken

### Critical integration failures
1. **The frontend never used the real backend.** Every checker route
   (`/countries`, `/{country}/questions`, `/{country}/check`) requires a Clerk
   Bearer token (`HTTPBearer(auto_error=True)`), but the frontend `apiFetch` sent
   no `Authorization` header. Every real call returned **401**, and the component
   silently fell back to a hardcoded **demo mode** — so the app appeared to work
   while running entirely on fake data.

2. **Real backend data would have crashed the UI** (masked only by demo mode):
   - Questions: backend uses `question_id` / `question_text` / `input_type`; the
     frontend expected `id` / `text` / `type`. Real questions → no controls render.
   - Result: backend returns `critical_blockers` / `warnings` as **objects**
     `{question_id, message, rule}`; the UI rendered them as strings →
     "Objects are not valid as a React child" crash.
   - `ScoreRing` keyed colours off the backend's free-text `result` label against
     4 hardcoded keys → `undefined.gradId` crash on any other label.

3. **Routing flow from the spec didn't exist.** No `/student-visa/countries`, no
   `/student-visa/{country}`. It was a single `/student-visa` page with an
   in-component wizard. All entry points linked to `/student-visa`.

4. **Auth vs. copy contradiction.** Backend required login; UI said
   "No account needed." (Resolved per decision: **login is now required**.)

### Backend robustness gaps
5. Missing R2 env vars raised a raw `KeyError`. No request timeouts on R2 (a stalled
   call could hang a request). `rules.json` was never loadable. Startup coupled the
   API to a reachable DB (`create_all`) — a DB hiccup prevented boot.

### Important clarifications (spec assumptions that don't match the code)
- **There is no local "data folder."** Questions/scoring/rules live in **Cloudflare
  R2** under `parchivisa-data/student/{country}/`. The per-country loading was
  already correct and **not** hardcoded — that part was fine.
- **There is no document upload feature.** R2 is used **read-only** to fetch visa
  JSON. No `put_object`/upload code exists anywhere in the app, so "save uploaded/
  generated documents to R2" describes a feature that isn't built. Read-side R2 was
  hardened; nothing to fix on the (non-existent) write side.

---

## 2. What changed

### Auth (login now required, email stored)
- Frontend sends a fresh Clerk JWT as `Authorization: Bearer` on every API call.
- `/student-visa(.*)` is protected in middleware; unauthenticated users are
  redirected to `/sign-in`. The checker UI is also wrapped in an `AuthGate`.
- Added `/sign-in` and `/sign-up` Clerk pages.
- **Email storage:** the default Clerk session token has no `email` claim, so the
  backend now resolves it best-effort from Clerk's API (`fetch_email`, cached,
  never blocks/raises) when missing, then upserts `auth_user_id + email`.

### Frontend/backend contract aligned
- Rewrote `types/visa.ts` to the real backend shapes (object blockers/warnings,
  string result label, `question_id`/`input_type`, etc.).
- `ScoreRing` derives colour from the **numeric score** (tier) and shows the
  backend label verbatim — any label renders safely.
- `QuestionCard` renders a control from `input_type` + `options`
  (number / options / text / yes-no fallback).

### Routed flow + states (demo mode removed)
- `/student-visa` → redirects to `/student-visa/countries`.
- `/student-visa/countries` → country selector (real API).
- `/student-visa/[country]` → country-scoped checker.
- All entry links updated to `/student-visa/countries`.
- Every state handled: loading, empty, validation (required answers / "no answers"),
  unsupported country (404), backend error, R2 unavailable (503). Users never see
  raw errors or fake scores.

### Backend hardening
- R2: explicit missing-env error → clean **503**; connect/read **timeouts** +
  bounded retries; `BotoCoreError`/`ClientError` mapped to clean messages; added
  `load_rules()` and `is_supported_country()`.
- Routes: shared error mapper, unsupported-country short-circuit (**404**),
  structural questions/scoring mismatch → clean **500**.
- `main.py`: startup table creation is now best-effort (DB hiccup no longer blocks
  boot; use Alembic for real migrations).

---

## 3. Files updated

**Backend**
- `services/visa_data_service.py` — env guard, timeouts/retries, `load_rules`, `is_supported_country`, storage errors
- `routers/student_visa.py` — clean error mapping, unsupported-country 404, safe evaluate
- `main.py` — resilient startup/shutdown
- `auth/base.py` — optional `fetch_email` hook
- `auth/clerk.py` — `fetch_email` via Clerk API (cached, never raises)
- `auth/dependencies.py` — best-effort email enrichment before upsert
- `.env` / `.env.example` — added `CLERK_SECRET_KEY`

**Frontend**
- `types/visa.ts`, `lib/api.ts` (rewritten), `lib/useVisaApi.ts` (new)
- `middleware.ts` — protect `/student-visa(.*)`
- `app/student-visa/page.tsx` → redirect; `app/student-visa/countries/page.tsx` (new); `app/student-visa/[country]/page.tsx` (new)
- `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx` (new)
- `components/checker/`: `CountrySelector.tsx` (new), `CountryChecker.tsx` (new), `CheckerHeader.tsx` (new), `QuestionCard.tsx`, `ResultCard.tsx`, `ScoreRing.tsx` (rewritten); **deleted** `StudentVisaChecker.tsx` (demo dead code)
- `components/auth/AuthGate.tsx` (new)
- `components/Navbar.tsx`, `components/Footer.tsx`, `components/sections/ToolsSection.tsx`, `components/sections/HeroSection.tsx` — links → `/student-visa/countries`

---

## 4. How to test the full flow

### Prereqs (one-time)
- Backend `.env`: `R2_*`, `CLERK_JWKS_URL`, `CLERK_SECRET_KEY`, `DATABASE_URL` set.
- Frontend `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000`,
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.

### Run
```bash
# Backend
cd backend
pip install -r requirements.txt
python scripts/validate_visa_data.py     # confirms R2 has all questions/scoring/rules
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run build      # must compile with no errors
npm run dev
```

### Click-path
1. Home → "Check Student Visa Readiness" → lands on `/student-visa/countries`.
2. Not signed in → sign-in wall / redirect to `/sign-in`. Create an account.
3. Countries list loads from the backend (real, token-authenticated).
4. Pick a country → `/student-visa/{country}`; only that country's questions load.
5. Answer through → "See results" → real score, blockers, warnings, recommendations.
6. Confirm DB `users` row exists with your `auth_user_id` **and** `email`.

### Error cases to verify
- Unsupported slug `/student-visa/germany` → clean "not supported" screen.
- Stop the backend mid-session → clean "couldn't reach the server" + retry.
- Unset an `R2_*` var and restart backend → clean 503 "not configured", no stack trace.

---

## 5. Remaining risks & assumptions

- **R2 data schema is unverified in my environment** (no R2 egress from the sandbox).
  I coded the frontend against the contract the backend code already enforces
  (`readiness_engine.py`, `validate_visa_data.py`): `question_id`, `question_text`,
  `input_type`, `options?`, `user_help_text?`. **If your real `questions.json` uses
  a different `input_type` vocabulary, verify the QuestionCard control mapping**
  (`NUMBER_TYPES`/`TEXT_TYPES`/`BOOLEAN_TYPES`) and adjust the sets. Run
  `python scripts/validate_visa_data.py` first.
- **I could not run `next build` here** — the build sandbox mount was out of sync
  with the real files (it served stale/truncated copies). All edits were made and
  reviewed via the authoritative file tools. **Run `npm run build` locally to
  confirm a clean production build before deploying.**
- **Email storage depends on `CLERK_SECRET_KEY`** on the backend (now set). If you'd
  rather avoid the per-user Clerk API lookup, add an `email` claim to your Clerk
  session token (Dashboard → Sessions → customize) and it's read directly from the JWT.
- **Marketing copy** still mentions "free / no credit card" in a couple of sections;
  factually fine (it's free) but now an account is required — review if you want.
- `validate_visa_data.py` builds its endpoint from `R2_ACCOUNT_ID` (not in `.env`);
  the app service uses `R2_ENDPOINT_URL`. Set `R2_ACCOUNT_ID` if you run that script,
  or align it to `R2_ENDPOINT_URL`.
