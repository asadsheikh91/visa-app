// Zod validation for the report contract at the frontend boundary.
//
// `GET /reports/{token}` returns JSON produced by the backend. Before we render
// PII and (via the print route) hand it to Playwright for a PDF, we validate the
// payload against these schemas. A malformed payload is a hard error, not a
// silently half-rendered report. Keep this in lockstep with types/report.ts and
// backend/schemas/report.py.

import { z } from 'zod'
import type {
  ReportData,
  GeminiNarrationResponse,
} from '@/types/report'

export const severitySchema = z.enum(['critical', 'high', 'medium'])

export const criterionScoreSchema = z.object({
  key: z.string(),
  label: z.string(),
  sublabel: z.string(),
  score: z.number(),
  fill: z.enum(['pass', 'warn', 'crit']),
})

export const sourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  retrievedAt: z.string(),
})

export const findingSchema = z.object({
  id: z.string(),
  severity: severitySchema,
  title: z.string(),
  category: z.string(),
  explanation: z.string(),
  impact: z.string(),
  fixSteps: z.array(z.string()),
  bestPractices: z.array(z.string()),
  source: sourceSchema,
})

export const roadmapPhaseSchema = z.object({
  window: z.string(),
  theme: z.string(),
  items: z.array(z.string()),
})

export const documentItemSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  status: z.enum(['ready', 'pending', 'missing']),
  statusLabel: z.string(),
})

export const scoreBandSchema = z.object({
  label: z.string(),
  min: z.number(),
  max: z.number(),
})

export const applicantSchema = z.object({
  name: z.string(),
  targetCountry: z.string(),
  pathway: z.string(),
  occupationNoc: z.string(),
  assessmentDate: z.string(),
  age: z.number(),
  maritalStatus: z.string(),
  dependants: z.string(),
})

export const reportDataSchema = z.object({
  reportId: z.string(),
  issuedAt: z.string(),
  dataCurrentAs: z.string(),
  applicant: applicantSchema,
  overallScore: z.number(),
  band: z.string(),
  bandPositionPct: z.number(),
  bands: z.array(scoreBandSchema),
  verdictLead: z.string(),
  crsNote: z.string(),
  criteria: z.array(criterionScoreSchema),
  estCrs: z.number().nullable(),
  findings: z.array(findingSchema),
  roadmap: z.array(roadmapPhaseSchema),
  documents: z.array(documentItemSchema),
  prepTime: z.string(),
  costRange: z.string(),
  sources: z.array(sourceSchema),
  templateVersion: z.string(),
  promptVersion: z.string(),
})

// z.infer must be assignable to the hand-written interface; this line will fail
// to typecheck if the two drift, which is exactly the guard we want.
export type ReportDataParsed = z.infer<typeof reportDataSchema>
const _assertReportData: ReportData = {} as ReportDataParsed
void _assertReportData

/**
 * Parse an unknown payload into a typed ReportData, throwing ZodError on any
 * structural mismatch. Callers at the fetch boundary should use this rather than
 * casting the JSON.
 */
export function parseReportData(payload: unknown): ReportData {
  return reportDataSchema.parse(payload)
}

// ---------------------------------------------------------------------------
// Gemini narration contract (also validated server-side in Python; mirrored
// here so the frontend can, e.g., re-validate a cached narration in dev tools)
// ---------------------------------------------------------------------------

export const geminiNarrationSchema = z.object({
  id: z.string(),
  explanation: z.string(),
  impact: z.string(),
  fixSteps: z.array(z.string()),
  bestPractices: z.array(z.string()),
})

export const geminiNarrationResponseSchema = z.object({
  narrations: z.array(geminiNarrationSchema),
})

export type GeminiNarrationResponseParsed = z.infer<
  typeof geminiNarrationResponseSchema
>
const _assertNarration: GeminiNarrationResponse = {} as GeminiNarrationResponseParsed
void _assertNarration
