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

// Official authority + last-reviewed date for a destination (Trust/Sources layer)
export interface CountryAuthorityMeta {
  country:       string
  authority:     string
  official_url:  string
  last_reviewed: string  // ISO YYYY-MM-DD
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
// Personalized Action Plan (Module A)
// ---------------------------------------------------------------------------

export type ActionSeverity = 'critical' | 'high' | 'soft' | 'todo'
export type ActionEffort = 'high' | 'medium' | 'low'

export interface ActionStepSource {
  url?: string
  ids?: string[]
}

export interface ActionStep {
  id:              string
  title:           string
  why:             string
  how:             string
  severity:        ActionSeverity
  category:        string
  source:          ActionStepSource | null
  related_item_id: string
  effort:          ActionEffort
}

export interface ActionPlan {
  check_id:           string
  country:            string
  score:              number
  result:             string
  result_description: string
  steps:              ActionStep[]
  counts:             Record<ActionSeverity, number>
}

// ---------------------------------------------------------------------------
// Timeline & Deadline Planner (Module C)
// ---------------------------------------------------------------------------

export type MilestoneStatus = 'upcoming' | 'in_progress' | 'done' | 'skipped'

export interface TimelineMilestone {
  id:       string
  label:    string
  due_date: string          // ISO YYYY-MM-DD
  status:   MilestoneStatus
  note:     string
  source:   string | null   // official guidance URL when relevant
}

export interface TimelineStats {
  total:          number
  done:           number
  remaining:      number
  completion_pct: number
}

export interface VisaTimeline {
  id:          string
  country:     string
  intake_date: string
  milestones:  TimelineMilestone[]
  stats:       TimelineStats
  next_due:    TimelineMilestone | null
  created_at:  string
  updated_at:  string
}

/** PATCH body for editing a milestone. */
export interface MilestoneUpdate {
  status?: MilestoneStatus
  note?:   string
}

// ---------------------------------------------------------------------------
// SOP Reviewer (Module E)
// ---------------------------------------------------------------------------

export interface SopSection {
  name:        string
  score:       number
  assessment:  string
  suggestions: string[]
}

export interface SopFeedback {
  overall_score: number
  verdict:       string
  sections:      SopSection[]
  red_flags:     string[]
  rewrite_tips:  string[]
}

export interface SopReviewResponse {
  id:          string | null
  feedback:    SopFeedback
  remaining:   number
  created_at?: string
}

export interface SopHistoryItem {
  id:            string
  country:       string | null
  input_chars:   number
  overall_score: number
  verdict:       string
  created_at:    string
}

// ---------------------------------------------------------------------------
// Mock Interview (Module F)
// ---------------------------------------------------------------------------

export type InterviewRole = 'interviewer' | 'student'

export interface InterviewTurn {
  role:    InterviewRole
  content: string
}

export interface InterviewAssessment {
  overall_score: number
  verdict:       string
  strengths:     string[]
  weaknesses:    string[]
  tips:          string[]
}

export interface InterviewSession {
  id:           string
  country:      string | null
  status:       'active' | 'completed'
  transcript:   InterviewTurn[]
  assessment:   InterviewAssessment | null
  can_continue?: boolean
}

// ---------------------------------------------------------------------------
// Document Guidance Module
// ---------------------------------------------------------------------------

export type DocStatus = 'have' | 'done' | 'in_progress' | 'ready' | 'blocked'

export interface DocOffice {
  id?:                     string
  name:                    string
  authority?:              string
  city?:                   string | null
  address?:                string | null
  hours?:                  string | null
  online_appointment_url?: string | null
  map_link?:               string | null
  last_verified_at?:       string | null
}

export interface DocLaneNormal { cost: number | null; days: number | null }
export interface DocLaneUrgent { cost: number | null; days: number | null; appointment_url?: string | null }

export interface DocumentPlanNode {
  id:                string
  name:              string
  status:            DocStatus
  blocked_reason:    string
  issuing_authority: string | null
  official_url:      string | null
  validity_months:   number | null
  last_verified_at:  string | null
  source_url:        string | null
  prerequisites:     string[]
  unlocks:           string[]
  parallel_group:    number
  normal:            DocLaneNormal
  urgent:            DocLaneUrgent
  office:            DocOffice | null
}

export interface OrderedDocumentPlan {
  nodes:   DocumentPlanNode[]
  waves:   number
  summary: { total: number; have: number; outstanding: number }
}

export interface DocProfile {
  target_country:                  string
  education_level:                 string
  studied_in_pakistan:             boolean
  marital_status:                  string
  documents_already_held:          string[]
  needs_intermediate_equivalence?: boolean
}

// ---------------------------------------------------------------------------
// User visa profile (onboarding)
// ---------------------------------------------------------------------------

export interface UserProfile {
  preferred_name:        string | null
  applying_from_country: string | null
  nationality:           string | null
  applicant_type:        string | null
  interested_countries:  string[]
  primary_country:       string | null
  study_level:           string | null
  intended_intake:       string | null
  admission_status:      string | null
  funding_source:        string | null
  sponsor_relationship:  string | null
  funds_arranged:        string | null
  bank_statement_status: string | null
  previous_refusal:      string | null
  study_gap:             string | null
  dependants:            string | null
  main_help_needed:      string[]
  onboarding_completed:  boolean
}

/** Partial profile used as POST body when saving onboarding progress. */
export type ProfilePayload = Partial<{
  preferred_name:        string
  applying_from_country: string
  nationality:           string
  applicant_type:        string
  interested_countries:  string[]
  primary_country:       string
  study_level:           string
  intended_intake:       string
  admission_status:      string
  funding_source:        string
  sponsor_relationship:  string
  funds_arranged:        string
  bank_statement_status: string
  previous_refusal:      string
  study_gap:             string
  dependants:            string
  main_help_needed:      string[]
  onboarding_completed:  boolean
}>

// ---------------------------------------------------------------------------
// Visa File Builder (Sprint 1)
// ---------------------------------------------------------------------------

export type ChecklistStatus =
  | 'missing'
  | 'in_progress'
  | 'available'
  | 'not_applicable'
  | 'needs_review'

export type ChecklistPriority = 'critical' | 'high' | 'standard'

export interface ChecklistItem {
  id:       string
  title:    string
  category: string
  priority: ChecklistPriority
  status:   ChecklistStatus
  reason:   string
  guidance: string
}

export interface VisaFileCategory {
  key:              string
  label:            string
  total:            number
  completed:        number
  critical:         number
  critical_missing: number
}

export interface CategoryMeta {
  key:   string
  label: string
}

export interface VisaFileStats {
  total_items:      number
  completed:        number
  missing_total:    number
  critical_total:   number
  critical_missing: number
  completion_pct:   number
}

export interface VisaFile {
  id:               string
  visa_check_id:    string | null
  country:          string
  visa_type:        string
  items:            ChecklistItem[]
  categories:       VisaFileCategory[]
  category_meta:    CategoryMeta[]
  stats:            VisaFileStats
  next_actions:     string[]
  financial_proof:  FinancialProof | null
  sponsor_evidence: SponsorEvidence | null
  created_at:       string
  updated_at:       string
}

// ---------------------------------------------------------------------------
// Sponsor Evidence Module (Sprint 2)
// ---------------------------------------------------------------------------

export interface SponsorEvidenceInputs {
  relationship:             string
  sponsor_name:             string
  funds_in_sponsor_account: string
  bank_statement_status:    string
  income_proof_available:   string
  income_type:              string
  large_deposits:           string
  source_explainable:       string
}

export interface SponsorEvidence {
  inputs:   SponsorEvidenceInputs
  warnings: string[]
}

export interface SponsorEvidenceResponse {
  warnings: string[]
  file:     VisaFile
}

// ---------------------------------------------------------------------------
// Financial Proof Checker (Sprint 2)
// ---------------------------------------------------------------------------

export type FinancialProofStrength = 'weak' | 'moderate' | 'strong'

export interface FinancialProofInputs {
  tuition_fee:            number
  deposit_paid:           number
  available_funds:        number
  funding_source:         string
  funds_in_whose_account: string
  bank_statement_status:  string
  funds_held_duration:    string
  large_deposits:         string
  source_of_funds:        string
  income_proof_available: string
  scholarship_or_loan:    string
  course_location:        string   // UK only: 'london' | 'outside' | ''
  course_months:          number   // course length; UK caps maintenance at 9
}

export type RuleStatus = 'pass' | 'warn' | 'fail'

export interface RuleCheckSource {
  label?: string
  url?:   string
}

export interface FinancialProofRuleCheck {
  rule_id:   string
  label:     string
  status:    RuleStatus
  detail:    string
  threshold: string
  source:    RuleCheckSource | null
}

export interface FinancialProofResult {
  strength:             FinancialProofStrength
  score:                number
  required_estimate:    number
  available_funds:      number
  shortfall:            number
  currency:             string
  currency_symbol:      string
  critical_issues:      string[]
  documents_to_prepare: string[]
  rule_checks:          FinancialProofRuleCheck[]
  bank_statement_ready: boolean
}

export interface FinancialProof {
  inputs: FinancialProofInputs
  result: FinancialProofResult
}

export interface FinancialProofResponse {
  assessment: FinancialProofResult
  file:       VisaFile
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

// ---------------------------------------------------------------------------
// Financial Document Checker (Module 1)
// ---------------------------------------------------------------------------

/** One dated balance reading the user enters from their statement. */
export interface BalanceEntry {
  date:    string | null
  balance: number | null
}

/** The statement values the user types in manually, submitted to evaluate. */
export interface ManualStatement {
  bank_name:        string | null
  account_holder:   string | null
  currency:         string | null
  period_start:     string | null
  period_end:       string | null
  opening_balance:  number | null
  closing_balance:  number | null
  transactions:     BalanceEntry[]
}

/** Applicant context the rule engine needs that the statement itself can't supply. */
export interface DocEvaluateContext {
  applicant_name?:   string
  application_date?: string
  required_amount?:  number
  tuition_fee?:      number
  deposit_paid?:     number
  course_location?:  'london' | 'outside'
  course_months?:    number
  sponsor_names?:    string[]
  fx_rate_to_gbp?:   number
}

/** Same shape as FinancialProofRuleCheck — reused so both checkers render identically. */
export type DocRuleCheck = FinancialProofRuleCheck

export interface FinancialDocResult {
  overall_status:  RuleStatus
  required_amount: number
  currency:        string
  currency_symbol: string
  window:          { start: string | null; end: string | null; min_balance: number | null }
  rule_checks:     DocRuleCheck[]
  summary:         string
}

export interface DocEvaluateResponse {
  id:        string | null
  country:   string
  result:    FinancialDocResult
  remaining: number
}

export interface DocHistoryItem {
  id:             string
  country:        string | null
  bank_id:        string | null
  status:         string
  overall_status: RuleStatus | null
  created_at:     string
}

// ---------------------------------------------------------------------------
// Trust / Freshness (Module 2)
// ---------------------------------------------------------------------------

export type FreshnessStatusKind = 'fresh' | 'aging' | 'stale'

export interface CountryFreshness {
  country:       string
  authority:     string
  official_url:  string
  last_reviewed: string
  days_ago:      number | null
  status:        FreshnessStatusKind
  change_count:  number
  latest_change: string | null
}

export interface ChangelogEntry {
  country?:    string
  date:        string
  area:        string
  summary:     string
  impact:      'high' | 'medium' | 'low'
  source_url:  string
}

export interface TrustUpdates {
  country:   string
  since:     string | null
  new_count: number
  updates:   ChangelogEntry[]
}

export interface TrustPreferences {
  alerts_opt_in: boolean
}

// ---------------------------------------------------------------------------
// Outcome loop (Module 3)
// ---------------------------------------------------------------------------

export type VisaOutcomeKind = 'approved' | 'refused' | 'withdrawn' | 'pending'

export interface OutcomePrompt {
  should_prompt:  boolean
  visa_check_id?: string
  country?:       string | null
  score?:         number | null
}

export interface OutcomeRecord {
  id:              string
  visa_check_id:   string | null
  country:         string | null
  score:           number | null
  outcome:         VisaOutcomeKind
  refusal_reasons: string[]
  decided_at:      string | null
  created_at:      string
}

// Privacy: above the min-sample threshold the API returns a COARSENED rate
// (nearest 10%) and a banded total range ("10-20") — never raw approved/refused
// counts or the exact N (defends against temporal differencing). Below the
// threshold the band is suppressed (insufficient_data) with only a bare count.
export interface OutcomeBandStat {
  key:               string
  label:             string
  approval_rate:     number | null
  insufficient_data: boolean
  // disclosed bands only:
  total_range?:      string
  // suppressed bands only:
  total?:            number
  approved?:         number | null
  refused?:          number | null
}

export interface OutcomeOverallStat {
  approval_rate:     number | null
  insufficient_data: boolean
  total_range?:      string
  total?:            number
  approved?:         number | null
  refused?:          number | null
}

export interface OutcomeStats {
  bands:   OutcomeBandStat[]
  overall: OutcomeOverallStat
}

// ---------------------------------------------------------------------------
// Guided journey (Module 4)
// ---------------------------------------------------------------------------

export type JourneyStepStatus = 'done' | 'current' | 'todo' | 'blocked'

export interface JourneyStep {
  id:      string
  label:   string
  status:  JourneyStepStatus
  detail:  string
  href:    string | null
  weight:  number
}

export interface Journey {
  steps:             JourneyStep[]
  overall_pct:       number
  next_step_id:      string | null
  next_action_label: string
  complete:          boolean
}

// ---------------------------------------------------------------------------
// Consultant / organization workspace (Module 5)
// ---------------------------------------------------------------------------

export interface OrgInfo {
  id:   string
  name: string
  plan: string
}

export interface MyOrg {
  org:  OrgInfo | null
  role?: 'owner' | 'consultant' | 'admin'
}

export interface ClientJourneySummary {
  overall_pct:       number
  next_action_label: string
  complete:          boolean
}

export interface RosterClient {
  id:      string
  email:   string
  status:  'invited' | 'active' | 'declined' | 'removed'
  journey: ClientJourneySummary | null
}

export interface OrgInvitation {
  id:       string
  org_name: string
}

export interface ClientJourneyResponse {
  email:   string
  journey: Journey
}
