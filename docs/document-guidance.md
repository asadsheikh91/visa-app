# Document Guidance Module

Purpose: destroy the information asymmetry that lets agents fleece Pakistani
student-visa applicants and pushes them toward bribery. Given ~5 facts about a
user, it outputs the **minimum ordered set of documents** that specific user needs
— prerequisites first, parallelizable steps grouped, short-lived documents
scheduled late — with the **legal fast-track** (official urgent fee / online
appointment) on every step. It is a personalized dependency graph, **not** a
directory of offices. Nothing here advises informal fixers or "navigating"
officials.

Scope: **UK, USA, Canada, Australia** · persona = master's applicant who studied
in Pakistan · offices = Islamabad / Rawalpindi only. Each document's
`country_relevance` controls which destinations need it; the engine prunes per
`target_country`. **All seeded values (incl. `country_relevance`) are placeholders
to verify.**

## Architecture

Standalone module. The pure traversal has no DB dependency; the service loads the
graph and persists progress.

```
routers/document_guidance.py      POST /plan · PATCH /state · POST /corrections  (Clerk-auth)
services/document_guidance_service.py   DB load + persist; get_document_path(db, profile, user_id)
services/document_guidance_engine.py    pure traversal: prune → topo → waves → validity delay → status
scripts/seed_document_guidance.py       editable UK seed (placeholders to verify)
models.py                               documents, document_edges, offices, user_document_state, corrections
alembic/versions/011_add_document_guidance.py
```

### Future scoring-engine interface
The readiness engine (`services/readiness_engine.py`, rules-based) can later call
the standalone entry point:

```python
from services.document_guidance_service import get_document_path
plan = await get_document_path(db, profile, user_id=user.id)
# plan["summary"]["outstanding"] → "you're missing N documents, here's your path"
```

`user_document_state` is queryable per user (`document_id, status`) so a future
score can read document progress directly. The module is **not** coupled to the
scoring engine today — the boundary is this one function.

## Data model

- **documents** — string-slug PK (e.g. `cnic`). `country_relevance` (JSON list),
  `issuing_authority`, `official_url`, `normal_cost`/`urgent_cost`,
  `normal_days`/`urgent_days` (all nullable — prefer linking over hardcoding),
  `validity_months` (nullable; expiring docs), `office_id` (FK), `display_order`
  (topo tie-break), **`last_verified_at` (NOT NULL, shown in UI)**, `source_url`.
- **document_edges** — `document_id` requires `requires_id`, optional `condition`
  (e.g. `needs_intermediate_equivalence`). The prerequisite DAG.
- **offices** — string-slug PK, `authority`, `city`, `address`, `lat`/`lng`,
  `hours`, `online_appointment_url` (legal fast-track), **`last_verified_at`**.
  The map link is generated, never stored:
  `https://www.google.com/maps/search/?api=1&query={lat},{lng}` (no Places API).
- **user_document_state** — per-user progress, enum `user_document_status`
  (`have, blocked, in_progress, done`); the engine derives `blocked`/`ready`, UI
  writes `have`/`in_progress`/`done`. Unique `(user_id, document_id)`.
- **corrections** — "this is wrong / office moved" flags. `user_id` nullable; no
  moderation UI in the MVP.

## The traversal (engine)

1. **Prune** — keep target-country docs; drop edges whose `condition` is unmet;
   then drop any document that is *conditional-only* (its country-relevant edge was
   removed by a failed condition and it has no surviving edge). This makes IBCC
   disappear for a degree holder while CNIC stays (the police certificate still
   needs it). Genuinely standalone docs are kept.
2. **Topological sort** — Kahn's algorithm, deterministic tie-break
   `(display_order, id)`. No doc precedes its prerequisites.
3. **Parallel waves** — each node's rank = depth of its *outstanding* prerequisites
   (held/done prereqs don't add depth). Same-rank nodes have no dependency between
   them → grouped as "can be done at the same time."
4. **Validity-window delay** — docs with `validity_months` are pushed to the latest
   wave their dependents allow, so a police certificate / TB test isn't scheduled
   early and expire before submission.
5. **Legal fast lane** — every node carries normal vs urgent cost/days plus the
   office's `online_appointment_url`.

## Accuracy — non-negotiable

- Every document/office row carries `last_verified_at`; the UI shows
  "Verified <date> · check official source".
- Volatile fields (fees) are left **null** with the `official_url` shown rather than
  shipping a number we can't re-verify. The whole seed is placeholders today.
- Every card has a **"this is wrong"** flag → writes a `corrections` row.

## How to add / verify a document

1. Edit `scripts/seed_document_guidance.py`:
   - Add/update the dict in `DOCUMENTS` (and `OFFICES` if new).
   - Set `official_url`. Fill `normal_cost`/`urgent_cost`/`*_days` **only** if you
     verified them against the official source; otherwise leave `None`.
   - Set `validity_months` for expiring documents.
   - Add prerequisite rows to `EDGES` (with a `condition` if it's scenario-specific).
2. Set the top-level `LAST_VERIFIED` to today's date and confirm each row's values
   against its `official_url`.
3. Run the seed: `python -m scripts.seed_document_guidance` (idempotent; upserts by
   slug, rebuilds edges, never touches user progress).

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/visa/documents/plan` | `DocProfile` | `OrderedDocumentPlan` |
| PATCH | `/api/visa/documents/state` | `{document_id, status}` | `{document_id, status}` |
| POST | `/api/visa/documents/corrections` | `{document_id?, office_id?, note}` | `{ok: true}` |

All require a Clerk session (403 otherwise).

`DocProfile`: `target_country, education_level, studied_in_pakistan,
marital_status, documents_already_held[], needs_intermediate_equivalence?`.

## Tests

`tests/test_document_guidance_engine.py` — pruning (IBCC dropped / CNIC kept,
country filter), topological validity, parallel detection, validity-window delay,
status computation. Pure, no DB.
