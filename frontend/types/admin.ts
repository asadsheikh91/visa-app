// Admin panel DTOs — mirror the /api/admin/* responses in backend/routers/admin.py.

export interface AdminFunnelStage {
  stage: string
  count: number
}

export interface AdminOverview {
  registered_users: number
  onboarded_users: number
  users_attempted: number
  users_completed_check: number
  users_with_report: number
  total_checks: number
  total_reports: number
  sessions_started: number
  sessions_completed: number
  sessions_abandoned: number
  plan_breakdown: Record<string, number>
  outcome_breakdown: Record<string, number>
  funnel: AdminFunnelStage[]
}

export interface AdminUserRow {
  id: string
  email: string | null
  preferred_name: string | null
  plan: string
  onboarded: boolean
  checks: number
  reports: number
  check_limit: number | null
  report_limit: number | null
  created_at: string
}

export interface AdminUserList {
  users: AdminUserRow[]
  total: number
  limit: number
  offset: number
}

export interface AdminCheckSummary {
  id: string
  country: string
  visa_type: string
  score: number
  result: string
  result_description: string
  created_at: string
}

export interface AdminReportRow {
  id: string
  report_id: string
  visa_check_id: string | null
  narrated_by_ai: boolean
  created_at: string
}

export interface AdminOutcomeRow {
  id: string
  country: string | null
  score: number | null
  outcome: string
  decided_at: string | null
  created_at: string
}

export interface AdminFinancialDocRow {
  id: string
  doc_type: string
  country: string | null
  bank_id: string | null
  status: string
  evaluated: boolean
  created_at: string
}

export interface AdminUserDetail {
  user: {
    id: string
    email: string | null
    auth_user_id: string | null
    plan: string
    created_at: string
    readiness_check_limit: number | null
    report_limit: number | null
    effective_check_limit: number | null
    effective_report_limit: number | null
  }
  profile: Record<string, unknown> | null
  checks: AdminCheckSummary[]
  reports: AdminReportRow[]
  outcomes: AdminOutcomeRow[]
  usage: {
    checks: number
    reports: number
    sop_reviews: number
    interview_sessions: number
    financial_documents: number
  }
  financial_documents: AdminFinancialDocRow[]
  document_progress: Record<string, number>
}

// Full readiness-check detail (answers + result) for the drill-down.
export interface AdminCheckDetail extends AdminCheckSummary {
  critical_blockers: unknown[]
  high_risk_flags: unknown[]
  soft_warnings: unknown[]
  warnings: unknown[]
  recommendations: string[]
  normalized_answers: Record<string, unknown>
  sources_used: unknown[]
}

export interface AdminUserUpdate {
  plan?: string
  readiness_check_limit?: number
  report_limit?: number
  clear_check_limit?: boolean
  clear_report_limit?: boolean
}
