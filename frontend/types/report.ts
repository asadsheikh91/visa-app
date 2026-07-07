// Downloadable Readiness Report — shared data contract (the spine of the feature).
//
// Data flow:  readiness engine + RAG  →  Gemini narrator  →  React template / PDF.
//
// SINGLE SOURCE OF TRUTH for the report's shape. The backend Pydantic models in
// backend/schemas/report.py mirror these field-for-field (camelCase on the wire),
// and backend/lib boundary validation on the frontend lives in lib/reportSchema.ts.
//
// FACTS vs PROSE:
//   Every field here is produced by the deterministic engine/RAG layer EXCEPT the
//   four fields on `Finding` explicitly marked below. Those four are the ONLY
//   fields Gemini is allowed to write. Gemini never originates a number, a
//   severity, a source, or the existence of a finding.

export type Severity = 'critical' | 'high' | 'medium'

/** A per-criterion score bar in the "Score Breakdown" section. Engine-owned. */
export interface CriterionScore {
  key: string
  label: string
  sublabel: string
  score: number // 0–100
  fill: 'pass' | 'warn' | 'crit'
}

/** An official policy source. Engine/RAG-owned — Gemini may cite but never invent. */
export interface Source {
  title: string
  url: string
  retrievedAt: string // human label, e.g. "Jun 2026"
}

/**
 * A single finding. Its identity (id, severity, title, category, source) is
 * decided entirely by the engine. Only `explanation`, `impact`, `fixSteps`, and
 * `bestPractices` are Gemini-written prose (or deterministic fallback prose).
 */
export interface Finding {
  id: string
  severity: Severity
  title: string
  category: string
  // ── Gemini-written prose fields (the ONLY LLM-authored content) ──
  explanation: string
  impact: string
  fixSteps: string[]
  bestPractices: string[]
  // ── end Gemini-written fields ──
  source: Source
}

/** One phase of the recommended action roadmap. Engine-owned. */
export interface RoadmapPhase {
  window: string // e.g. "0–2 Months"
  theme: string // e.g. "Foundations"
  items: string[]
}

/**
 * A row of the document checklist. Engine-owned.
 *   `status`      — coarse bucket, drives the pill colour (3 states).
 *   `statusLabel` — the exact wording the design shows ("Needs revision",
 *                   "In progress", "Not started", …). Kept separate so we don't
 *                   lose the specific label when bucketing to a colour.
 */
export interface DocumentItem {
  name: string
  purpose: string
  status: 'ready' | 'pending' | 'missing'
  statusLabel: string
}

/**
 * One segment of the readiness band meter. Engine-owned and country-variable —
 * the meter is rendered from this array, never from hardcoded segments, because
 * `score_bands` differ per country.
 */
export interface ScoreBand {
  label: string
  min: number
  max: number
}

/** Applicant header block. All fields engine/profile-owned (PII — encrypted at rest). */
export interface Applicant {
  name: string
  targetCountry: string
  pathway: string
  occupationNoc: string
  assessmentDate: string
  age: number
  maritalStatus: string
  dependants: string
}

/**
 * The complete report payload rendered by the React template and the PDF print
 * route. This is what `GET /reports/{token}` returns and what Zod validates at
 * the frontend boundary.
 */
export interface ReportData {
  reportId: string // human-readable, e.g. "PV-CA-2026-0417"
  issuedAt: string // human label, e.g. "03 Jul 2026"
  dataCurrentAs: string // human label, e.g. "Jun 2026"
  applicant: Applicant
  overallScore: number // 0–100
  band: string // e.g. "Conditional"
  bandPositionPct: number // 0–100, marker position on the meter
  bands: ScoreBand[] // meter segment definitions (country-variable)
  // Engine-templated prose (NOT Gemini-authored). Produced by a pure
  // render_verdict() from a reviewed template library and stamped under
  // templateVersion, so any wording change busts the narration cache.
  verdictLead: string // the summary paragraph under the score
  crsNote: string // CRS callout sentence; "" when CRS is not applicable
  criteria: CriterionScore[]
  estCrs: number | null // Canada CRS estimate; null where not applicable
  findings: Finding[]
  roadmap: RoadmapPhase[]
  documents: DocumentItem[]
  prepTime: string // e.g. "5–8 months"
  costRange: string // e.g. "$2,300–3,500 CAD"
  sources: Source[]
  templateVersion: string
  promptVersion: string
}

// ---------------------------------------------------------------------------
// Gemini narration contract (schema-locked)
// ---------------------------------------------------------------------------

/** What the builder feeds Gemini per finding. Gemini may use ONLY these facts. */
export interface GeminiFindingInput {
  id: string
  severity: Severity
  title: string
  category: string
  rawSignal: string // the deterministic signal the engine detected
  policyContext: string[] // retrieved official policy excerpts
}

/** What Gemini returns per finding — nothing but prose for the four allowed fields. */
export interface GeminiNarration {
  id: string
  explanation: string
  impact: string
  fixSteps: string[]
  bestPractices: string[]
}

/** The ONLY valid top-level shape Gemini may return. */
export interface GeminiNarrationResponse {
  narrations: GeminiNarration[]
}
