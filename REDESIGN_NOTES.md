# ParchiVisa — Landing Redesign & Route Restructure

Date: 2026-06-04

## What changed

**Homepage (`/`) rebuilt** to a focused, premium layout — no more full Tools/
How-It-Works/Reviews sections on the homepage. It now contains only:
1. **Hero** — 3 zones: *Before you apply.* (left) · center copy + CTAs + trust points
   (right) *Know your visa readiness.* Center copy is the exact spec sentence.
2. **Floating readiness card** — UK Student Visa · Tier 4 · score 78 · *Mostly Ready*
   with the CAS / Financial / IELTS / TB checklist and a *View Full Report* action.
3. **Trust strip** — four short credibility points.
4. **Country CTA** — short country picker (UK/USA/Canada/Australia) + "See all".
5. **Footer** (in layout).

**Dynamic globe** (`GlobeBackground`) — a sober dotted sphere with a soft purple→
orange arc, fixed behind content, **drifting left→right on scroll** via a
`requestAnimationFrame` handler (no per-frame React renders). It is **disabled on
mobile and when `prefers-reduced-motion` is set** (`usePrefersReducedMotion`), and
defaults to static until measured (SSR-safe). Low opacity, no heavy glow.

**CTA behavior** — primary CTA goes **straight to `/tools/student-visa/countries`**
(no generic tools detour); secondary goes to `/tools`.

## Routes (page-based, scalable)

| Path | Page |
|---|---|
| `/` | New landing |
| `/tools` | Tools listing |
| `/tools/student-visa` | Student-visa overview |
| `/tools/student-visa/countries` | Country selector (auth) |
| `/tools/student-visa/countries/[country]` | Per-country checker — serves `/uk`, `/usa`, `/canada`, `/australia` (auth) |
| `/how-it-works` | How it works |
| `/about` | About |
| `/sign-in`, `/sign-up` | Clerk |
| `/dashboard` | Signed-in dashboard (auth) |

Nav routes to **separate pages** (Home / Tools / How It Works / About), not homepage
anchors. No Reviews page (none created — no real reviews yet). Sign In + Get Started kept.

Old `/student-visa`, `/student-visa/countries`, `/student-visa/[country]` now **redirect**
to the new `/tools/...` equivalents (slugs preserved), so existing links keep working.

Middleware now protects `/tools/student-visa(.*)` and `/dashboard(.*)`.

## New / changed files

**New:** `components/landing/{GlobeBackground,Hero,ReadinessCard,TrustStrip,CountryCTA}.tsx`,
`lib/usePrefersReducedMotion.ts`,
`app/tools/page.tsx`, `app/tools/student-visa/page.tsx`,
`app/tools/student-visa/countries/page.tsx`, `app/tools/student-visa/countries/[country]/page.tsx`,
`app/how-it-works/page.tsx`, `app/about/page.tsx`, `app/dashboard/page.tsx`.

**Changed:** `app/page.tsx` (new homepage), `components/Navbar.tsx` + `components/Footer.tsx`
(page links), `components/sections/ToolsSection.tsx` (card → `/tools/student-visa`),
`components/checker/{CountrySelector,CountryChecker,ResultCard}.tsx` (links → `/tools/...`),
`middleware.ts`, and the old `app/student-visa/*` pages (now redirects).

**Removed (dead code):** `components/sections/{HeroSection,StatsSection,TestimonialsSection}.tsx`.

## Verification

- `npx tsc --noEmit` — **passes clean** (whole frontend, all new files).
- `npx next build` could **not** run in my sandbox: your `node_modules` was installed
  on Windows, so the Linux container lacked the native SWC binary and tried to download
  it with no network. **Run `npm run build` on your machine** — it will use the existing
  Windows SWC binary. (This is environmental, not a code issue.)

## How to test
```bash
cd frontend
npm run dev
```
- `/` → globe drifts subtly as you scroll; reduced-motion/mobile = static.
- Primary CTA → `/tools/student-visa/countries` (sign-in wall if logged out).
- Nav items load separate pages. Footer/legacy `/student-visa` links resolve to `/tools/...`.

## Notes / assumptions
- No new dependencies added (no Framer Motion — globe is CSS + a tiny rAF hook).
- The globe is a **dotted tech-sphere**, not a literal world map (no map asset in repo).
  Swap the `<Globe>` SVG for a dotted world-map SVG later if you want literal continents.
- The hero readiness card is **illustrative/static** by design (sample output).
- Marketing copy elsewhere ("free / no credit card") is still accurate, but an account
  is required to run a check — review the wording if you want it tighter.
