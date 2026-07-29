# ParchiVisa — LinkedIn copy

Grounded in the actual codebase. Every claim below is verifiable in this repo.

---

## HEADLINE (220 char limit)

**Pick one. A is the strongest for a mixed audience.**

**A — mixed / default**
> Founder, ParchiVisa — student visa readiness scored against the actual UKVI, IRCC & Home Affairs rulebook. Building AI products where the model isn't allowed to decide anything.

**B — engineer / recruiter facing**
> Full-stack engineer — Python/FastAPI · Next.js · Postgres | Built a 4-country visa rules engine, solo: 1,000+ tests, deterministic scoring, schema-locked LLM narration

**C — customer / market facing**
> Founder, ParchiVisa | We tell you what's wrong with your student visa file before the embassy does. UK · Australia · Canada · USA

**D — investor / cofounder facing**
> Founder, ParchiVisa — pre-application readiness infrastructure for the $X00M Pakistani study-abroad market. Not an agent. Not a promise. A verdict.
> (Only use D if you can defend the market number. Otherwise use A.)

---

## ABOUT — Version 1: Founder-first (RECOMMENDED)

Best all-round. Leads with the problem, earns credibility with the engineering,
closes with an invitation. ~2,300 chars, under LinkedIn's 2,600 limit.

---

Every year, thousands of Pakistani students pay for a student visa application that was never going to pass. The refusal letter is the first honest feedback they get — after the money is gone and the intake is missed.

ParchiVisa gives them that feedback first.

It's a readiness engine for UK, Australia, Canada and USA student visas. You answer a structured questionnaire about your file — funds, sponsor, CAS/I-20, English, ties, intent — and it scores that file against the published rules from UKVI, IRCC, the Department of Home Affairs and the US State Department. Not a vibe check. Hard blockers, risk flags, and the specific 28-day clock you're about to run out of.

The engineering decision I'm proudest of is the one that sounds least impressive: **no LLM touches the score.**

Every verdict comes from a deterministic rules engine — structured conditions, computed financial thresholds (the UK's 28-day lowest-balance rule, Quebec branching for Canada, dependant loading for Australia), hard blockers, band capping. AI is used, but it's caged. A schema-locked narrator rewrites prose only, and any number it emits that wasn't already in the engine's output is rejected and discarded. If the model is unavailable, the report still generates from deterministic templates.

A tool that tells someone their file is fine when it isn't causes real financial damage. That risk is not worth a fluent paragraph.

What I've built, solo:

• FastAPI + PostgreSQL backend — 17 routers, ~37 services, 869 tests
• Next.js 14 + TypeScript frontend — 90+ components, 154 tests
• Deterministic readiness engine covering 4 destination countries
• AI SOP reviewer and mock credibility interview (Claude); schema-locked report narration (Gemini)
• Server-rendered PDF reports — Fernet-encrypted at rest, unguessable tokens, private object storage, short-lived signed URLs
• A source-freshness layer, so every rule traces to a government URL with a last-reviewed date — stale rules are made visible rather than quietly trusted
• Consultant workspace, org seats, usage caps, billing, admin panel

We are not an agent. We don't file your application and we never promise a visa.

Open to talking with anyone working on immigration tech, or on getting deterministic guarantees out of LLM products.

---

## ABOUT — Version 2: Engineer-first

Use this if the goal is jobs, contracts, or engineering credibility.
Same facts, weighted toward the build. ~2,100 chars.

---

I build systems where being wrong is expensive, so I design them to be wrong loudly rather than confidently.

Most recently: ParchiVisa, a student visa readiness engine for UK, Australia, Canada and USA applicants. It takes a structured intake and scores the applicant's file against published UKVI / IRCC / Home Affairs / State Department rules, returning hard blockers, risk flags, and a per-criterion breakdown.

The core constraint I set, and the reason the architecture looks the way it does: **the LLM is not permitted to decide anything.**

Scoring is a pure deterministic engine — structured condition evaluation, computed financial thresholds (UK 28-day lowest-balance window, Quebec branching, AUS dependant loading), hard blockers, high-risk-flag band capping. The LLM's entire job is rewriting four prose fields per finding, under a response schema, with a validator that rejects any figure not already present in the engine's output, plus a deterministic template fallback for when the provider is down. The report never hard-depends on a live model call.

The rest of the system, built solo:

• FastAPI + async SQLAlchemy + Postgres + Alembic; 17 routers, ~37 services
• 869 backend tests, 154 frontend tests
• Next.js 14 / TypeScript / Tailwind / Clerk — 90+ components, 24 typed API hooks
• Fernet field-level encryption for PII columns (key lives in the app env, never reaches the database — a DB or backup compromise yields ciphertext only)
• Cloudflare R2 with Redis caching and graceful degradation to direct fetch
• Server-side PDF generation via Playwright rendering the same React template as the on-screen route — one template, not two
• Hardened API surface: CSP, HSTS, pre-parse body-size ceiling, rate limiting, docs and OpenAPI schema disabled in production
• Multi-tenant layer: organizations, consultant roles, client rosters, seat limits, usage caps, webhook billing

Interested in immigration tech, and in the general problem of making LLM products give guarantees instead of vibes.

---

## ABOUT — Version 3: Short (if you want punchy)

~700 chars. Higher read-through, lower depth.

---

Founder of ParchiVisa — a readiness engine for UK, Australia, Canada and USA student visas.

Students find out their file was never going to pass from the refusal letter, after the money's gone. We tell them first, scored against the actual published UKVI / IRCC / Home Affairs rules.

One design rule drives the whole architecture: no LLM touches the score. Verdicts come from a deterministic rules engine. The model only rewrites prose, under a schema, and any number it invents is rejected. If the model is down, the report still generates.

Built solo: FastAPI + Postgres, Next.js 14, 1,000+ tests, encrypted reports, and a freshness layer so every rule traces to a government source.

We are not an agent. We never promise a visa.

---

## EXPERIENCE ENTRY (the role block, not the About)

**Founder & Engineer · ParchiVisa · [Month Year] – Present**

Student visa readiness assessment for Pakistani applicants targeting UK, Australia, Canada and USA.

• Designed and built the full product solo — FastAPI/Postgres backend (17 routers, ~37 services, 869 tests) and Next.js 14/TypeScript frontend (90+ components, 154 tests).
• Built a deterministic readiness engine encoding published immigration rules across 4 countries, including the UK's 28-day lowest-balance maintenance test, Canadian provincial branching, and Australian dependant funding.
• Architected a schema-locked LLM narration layer that cannot originate facts: output is validated against a response schema and rejected if it contains any figure absent from the deterministic engine's output, with a template fallback so reports never depend on a live model call.
• Shipped PII-safe reporting — Fernet field encryption with the key isolated from the database, tokenised report access, private object storage with short-lived signed URLs.
• Built the B2B layer: consultant workspaces, org seats, client rosters, usage caps, webhook billing, admin panel.

---

## BEFORE YOU POST — fix list

1. **`README.md` at the repo root is stale and contradicts everything above.**
   It says "VisaScore — Schengen Visa Risk Assessment," pitches €185 Schengen
   rejections, names LemonSqueezy and "Claude Opus 4.5" as the scoring engine.
   The real product is ParchiVisa, student visas, 4 countries, Gumroad, and a
   deterministic scorer. Rewrite it or make the repo private. One click and
   your credibility is gone.

2. **Do not add a traction number you can't defend.** There is no user data in
   this repo. "Helping thousands of students" is one question away from
   collapsing. Lead with engineering judgment until you have real numbers,
   then swap the opening paragraph.

3. **Add a Featured link** to the live site or a real sample report. The Hero
   currently has a TODO pointing "See a real report first" at /#how-it-works
   instead of an actual ungated sample. Ship that sample, then feature it.

4. **The `last_reviewed` dates in `country_sources.py` say 2025-01-15.** If
   anyone checks, your "freshness layer" is over a year stale — which is the
   exact failure mode the layer exists to prevent. Update them before you
   publicly claim rules traceability.
