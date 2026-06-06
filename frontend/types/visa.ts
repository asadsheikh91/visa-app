// Frontend types — in lockstep with the backend contract.
// Backend sources of truth:
//   - services/readiness_engine.py  (engine result shape)
//   - routers/student_visa.py       (response envelope)
//   - services/visa_data_service.py (CANONICAL_QUESTION_FIELDS, COUNTRY_META)

// ---------------------------------------------------------------------------
// show_if condition (mirrors visa_data_service._evaluate_show_if)
// ---------------------------------------------------------------------------

export interface ShowIfSimple {
  question_id: string
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'multi_contains'
  value: string | string[]
}

export interface ShowIfCompound {
  operator: 'and' | 'or'
  conditions: ShowIf[]
}

export type ShowIf = ShowIfSimple | ShowIfCompound

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

export interface QuestionOption {
  label: string
  value: string
}

// The canonical set supported by the backend and the rendering engine.
export type InputType =
  | 'yes_no'
  | 'yes_no_unknown'
  | 'single_choice'
  | 'multi_choice'
  | 'date'
  | 'number'
  | 'currency_amount'
  | 'text'

export interface Question {
  id: string
  question: string
  help_text?: string
  input_type: InputType
  options?: QuestionOption[]
  required: boolean
  scoring_key: string
  risk_category: string
  validation?: unknown
  show_if?: ShowIf | null
  normalized_answer_format?: string
  error_message?: string
  blocker_possible: boolean
  source_url?: string
  source_ids?: string[]
  resolved_sources?: unknown[]
  // display grouping fields passed through by the API
  section?: string
  country?: string
  visa_route?: string
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

// multi_choice → string[], all others → string (numbers sent as numeric strings)
export type AnswerValue = string | string[]

// ---------------------------------------------------------------------------
// Country
// ---------------------------------------------------------------------------

export interface CountryMeta {
  country: string
  slug: string
  visa_route: string
}

// ---------------------------------------------------------------------------
// Check result
// ---------------------------------------------------------------------------

export interface ResultIssue {
  question_id: string
  message: string
  rule?: string
  rule_id?: string
  severity?: string
  source_url?: string
  source_ids?: string[]
}

export interface SourceRef {
  source_url?: string
  source_ids?: string[]
  name?: string    // resolved display name (optional, from backend enrichment)
  title?: string   // alternative resolved title (optional)
}

export interface CheckResult {
  id: string | null      // null if DB save failed (best-effort)
  visa_type: string
  country: string
  result: string
  result_description: string
  score: number
  critical_blockers: ResultIssue[]
  high_risk_flags: ResultIssue[]
  soft_warnings: ResultIssue[]
  warnings: ResultIssue[]
  recommendations: string[]
  normalized_answers: Record<string, unknown>
  sources_used: SourceRef[]
  required_missing_answers: string[]
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

export interface QuestionsResponse {
  visa_type: string
  country: string
  questions: Question[]
  rules?: unknown[]
}

// A saved check as returned by GET /history
export interface HistoryItem {
  id: string
  country: string
  visa_type: string
  score: number
  result: string
  result_description: string
  critical_blockers: ResultIssue[]
  high_risk_flags: ResultIssue[]
  soft_warnings: ResultIssue[]
  warnings: ResultIssue[]
  recommendations: string[]
  normalized_answers: Record<string, unknown>
  sources_used: SourceRef[]
  created_at: string  // ISO 8601
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

export type ReadinessTier = 'ready' | 'mostly_ready' | 'needs_work' | 'not_ready'

// Maps a 0–100 score to a display tier. The backend is the source of truth
// for the actual label + description; this is for colour/icon only.
export function tierFromScore(score: number): ReadinessTier {
  if (score >= 85) return 'ready'
  if (score >= 65) return 'mostly_ready'
  if (score >= 40) return 'needs_work'
  return 'not_ready'
}
