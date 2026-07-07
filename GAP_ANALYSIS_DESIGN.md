# Gap Analysis Section — Design Proposal

**Status: proposal for review. Not yet wired into the report pipeline.**

Adds a deterministic "what is reducing your score" section to the Readiness
Report: for every criterion that is not fully satisfied — the rule name, the
applicant's actual value, the required value, and the exact point impact.
No encouragement, no softening, no LLM judgment. Grounded strictly in the
rule engine's structured output.

---

## 1. Prerequisite: structured per-rule output from the engine

### What exists today

`evaluate()` (services/readiness_engine.py) returns a final aggregate score
plus triggered issue lists (`critical_blockers`, `high_risk_flags`,
`soft_warnings`, `warnings`). `category_breakdown()` returns per-category
0–100 percentages. **Neither exposes per-question point attribution** — the
per-rule deduction is computed inside evaluate() Step 2 and immediately
summed away. This is the first thing to build.

### New pure function: `rule_results()`

```
rule_results(questions, scoring, answers) -> list[RuleResult]
```

Lives in `services/readiness_engine.py` next to `category_breakdown()`, and
follows the same contract: **read-only, pure, and reusing `_is_passing` /
`_question_id` / `_compute_financial_threshold`** so it can never drift from
the headline score (the same protection that keeps `category_breakdown`
honest).

Each scored question yields one `RuleResult`:

```json
{
  "question_id":      "uk_ielts_score",
  "rule":             "English language requirement (CEFR B2 / SELT)",
  "category_id":      "language",
  "category_label":   "Language",
  "status":           "passed | failed | unanswered",
  "answer":           5.5,
  "requirement":      {"type": "gte", "value": 6.0},
  "requirement_text": "at least 6.0",
  "points_available": 6.7,
  "points_earned":    0.0,
  "points_lost":      6.7
}
```

* `points_available` = `score_impact / total_category_impact * category.max_points`
  — the exact same arithmetic evaluate() uses, factored so both call it.
* `answer` is the **normalized** answer (via `normalize_answer`), i.e. the
  applicant's actual value.
* `requirement` is the machine-readable `pass_if`; `requirement_text` is a
  deterministic rendering of it (see §3). For computed financial thresholds
  (`computed_funds_*` etc.) the text renders the **resolved number** from
  `_compute_financial_threshold` — e.g. "at least GBP 24,913" — not the
  abstract formula.

Blockers and flags do not subtract points; they gate/cap. They are emitted as
their own entries so their effect is stated in the same section, quantified:

```json
{
  "question_id": "uk_study_gap_explained",
  "rule":        "Unexplained study/employment gap",
  "kind":        "high_risk_flag",
  "answer":      "no",
  "trigger":     {"type": "in", "value": ["no", "unknown"]},
  "effect":      {"band_cap_label": "High Refusal Risk", "score_cap": 69}
}
```

(`score_cap` comes from the same `_apply_band_cap`/`band_for_score` pair the
engine now uses — the section states the mechanism that actually moved the
number.)

### Invariant (tested)

`round(sum(points_earned))` == the engine's pre-cap score for the same
answers. A regression test runs both on identical inputs per country fixture
and fails if they ever disagree.

---

## 2. Rendering: deterministic template — no LLM (recommended)

One line per item, fixed order (blockers, then flags, then failed scored
rules sorted by `points_lost` descending, then unanswered), fixed wording:

```
Tuition funds held for 28 days: your answer — GBP 18,400; required — at least GBP 24,913; impact — −11.2 points.
Unexplained study/employment gap: your answer — no; required — yes; impact — readiness band capped at "High Refusal Risk" (score capped at 69).
Confirmation of Acceptance for Studies issued: unanswered; required — yes; impact — −8.0 points.
```

Nothing else. No adjectives, no "but" clauses, no counterweight sentences.

**Recommendation: bypass the LLM entirely.** Rationale:

* Deterministic templating **trivially and provably** satisfies every hard
  requirement: reproducibility (same input → byte-identical output), no
  softening (the template has no vocabulary for it), no omission (a loop
  cannot skip an item), no invented severity.
* An LLM never fully guarantees any of those; it can only be constrained and
  audited toward them. The only thing Gemini could add here is prose variety,
  which this section explicitly does not want.
* Zero latency/cost/failure-mode added to report generation.

If prose polish is later mandated anyway, the constraints are: temperature 0;
the structured facts injected as immutable JSON; output schema-locked exactly
like `GeminiNarrationResponse` (extra="forbid"); every number in the output
validated against the input's allowed-number set (the `_numbers` check in
gemini_narrator.py already does this for findings); **and the post-generation
softening scan below** — with automatic fallback to the deterministic
template on any violation. The band/label, if mentioned, is injected as a
fixed fact: "The applicant's readiness band is: {band}. Do not restate or
reinterpret this."

### Softening postcheck (applies even to the template path)

A deny-list scan over the final rendered section, because `rule` and
`requirement_text` strings originate in country data files that others edit:

```
still competitive · don't worry · shows promise · on the right track ·
almost there · great job · well done · strong foundation · minor issue ·
good news · encouragingly · fortunately
```

Match → the offending string is reported in logs and the item is re-rendered
from raw fields (question id + literal values only). The list lives beside
the template with its own tests, and is enforced in CI against the live
country data by `scripts/validate_visa_data.py`.

---

## 3. `requirement_text`: deterministic pass_if rendering

Small pure function, exhaustively tested, one branch per condition type:

| pass_if type          | rendering                          |
|-----------------------|------------------------------------|
| `eq` / `neq`          | "yes" / "anything except {v}"      |
| `gte` / `gt`          | "at least {v}" / "more than {v}"   |
| `lte` / `lt`          | "at most {v}" / "less than {v}"    |
| `in` / `not_in`       | "one of: {v, …}" / "none of: {v, …}" |
| `multi_has_any`       | "includes at least one of: {v, …}" |
| `any`                 | "provided"                         |
| `computed_*`          | resolved threshold via `_compute_financial_threshold` |

Unknown type → the raw JSON condition is printed verbatim (never guessed).

---

## 4. Wire-in plan (after this proposal is approved)

1. **Engine**: `rule_results()` + the sum invariant test + `requirement_text`
   renderer. Pure, additive, no behavior change. *Reviewable in isolation.*
2. **Schema**: `ReportData.gapAnalysis: list[GapItem]` in
   `backend/schemas/report.py`, mirrored in `frontend/types/report.ts` and
   `frontend/lib/reportSchema.ts` (the contract requires field-for-field
   parity). `TEMPLATE_VERSION` bump (busts the report cache key, so newly
   built reports include the section; existing reports are unaffected until
   rebuilt).
3. **Builder**: populate `gapAnalysis` in `build_report()` from
   `rule_results(raw_questions, scoring, check.normalized_answers)` — engine
   facts only, narration untouched.
4. **PDF/print template**: a "What is reducing your score" section in
   `frontend/components/report/` rendering items verbatim, one row each.
5. **Tests**: golden-file (same check → byte-identical section, two runs),
   boundary (a rule passing exactly at threshold produces no item), softening
   scan units, and the sum invariant per country.

Open question for review: should `passed` rules also render (as a compact
"satisfied" list) or does the section show only deficits? Default in this
design: deficits only, per the "exactly what is hurting the score" goal.
