import type {
  CountryMeta, CountryAuthorityMeta, CheckResult, QuestionsResponse, HistoryItem, AnswerValue,
  UserProfile, ProfilePayload,
  VisaFile, ChecklistStatus,
  FinancialProofInputs, FinancialProofResponse,
  SponsorEvidenceInputs, SponsorEvidenceResponse,
  ActionPlan,
  VisaTimeline, MilestoneUpdate,
  SopReviewResponse, SopHistoryItem,
  InterviewSession,
  DocProfile, OrderedDocumentPlan,
  ManualStatement, DocEvaluateContext, DocEvaluateResponse, DocHistoryItem,
  CountryFreshness, ChangelogEntry, TrustUpdates, TrustPreferences,
  OutcomePrompt, OutcomeRecord, OutcomeStats, VisaOutcomeKind,
  Journey,
  MyOrg, RosterClient, OrgInvitation, ClientJourneyResponse,
} from '@/types/visa'
import type { ReportData } from '@/types/report'
import { parseReportData } from '@/lib/reportSchema'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Typed error so the UI can branch on HTTP status (401 -> sign in, 404 ->
// unsupported, 503 -> temporarily unavailable, etc.).
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function apiFetch<T>(
  path: string,
  token: string | null,
  options?: RequestInit
): Promise<T> {
  if (!token) {
    throw new ApiError(
      'Missing auth token. Please sign in before using the visa checker.',
      401
    )
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers || {}),
      },
    })
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }))
    const message = body?.error || `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }

  return res.json() as Promise<T>
}

// Builds the API surface bound to a token getter.
export function createVisaApi(getToken: () => Promise<string | null>) {
  return {
    getCountries: async () =>
      apiFetch<CountryMeta[]>('/api/visa/student/countries', await getToken()),

    getQuestions: async (country: string) =>
      apiFetch<QuestionsResponse>(
        `/api/visa/student/${encodeURIComponent(country)}/questions`,
        await getToken()
      ),

    // answers keyed by question.id; multi_choice values are string[]
    checkReadiness: async (country: string, answers: Record<string, AnswerValue>) =>
      apiFetch<CheckResult>(
        `/api/visa/student/${encodeURIComponent(country)}/check`,
        await getToken(),
        { method: 'POST', body: JSON.stringify({ answers }) }
      ),

    getHistory: async () =>
      apiFetch<HistoryItem[]>('/api/visa/student/history', await getToken()),

    // Official authority + last-reviewed date for a destination (Module D).
    getCountryMeta: async (country: string) =>
      apiFetch<CountryAuthorityMeta>(
        `/api/visa/student/${encodeURIComponent(country)}/meta`,
        await getToken()
      ),
  }
}

export type VisaApi = ReturnType<typeof createVisaApi>

// ---------------------------------------------------------------------------
// Profile API
// ---------------------------------------------------------------------------

export function createProfileApi(getToken: () => Promise<string | null>) {
  return {
    /**
     * Fetch the current user's visa profile.
     * Throws ApiError with status 404 when no profile exists yet.
     */
    getProfile: async () =>
      apiFetch<UserProfile>('/api/user/profile', await getToken()),

    /** Create or update the user's visa profile (partial updates supported). */
    saveProfile: async (data: ProfilePayload) =>
      apiFetch<UserProfile>('/api/user/profile', await getToken(), {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  }
}

export type ProfileApi = ReturnType<typeof createProfileApi>

// ---------------------------------------------------------------------------
// Visa File Builder API
// ---------------------------------------------------------------------------

export function createVisaFileApi(getToken: () => Promise<string | null>) {
  return {
    /**
     * Fetch-or-create the visa file for a readiness check. Omitting checkId uses
     * the user's latest check. Idempotent: returns the existing file (with the
     * user's status edits) when one already exists for that check.
     */
    generateFile: async (checkId?: string) =>
      apiFetch<VisaFile>('/api/visa/file/generate', await getToken(), {
        method: 'POST',
        body: JSON.stringify(checkId ? { visa_check_id: checkId } : {}),
      }),

    /** Update a single checklist item's status; returns the recomputed file. */
    updateItemStatus: async (fileId: string, itemId: string, status: ChecklistStatus) =>
      apiFetch<VisaFile>(`/api/visa/file/${encodeURIComponent(fileId)}/item`, await getToken(), {
        method: 'PATCH',
        body: JSON.stringify({ item_id: itemId, status }),
      }),

    /**
     * Run the Financial Proof Checker against an existing visa file.
     * Injects fin_* checklist items and persists the evaluation.
     * Returns the assessment result and the updated file.
     */
    assessFinancialProof: async (fileId: string, inputs: FinancialProofInputs) =>
      apiFetch<FinancialProofResponse>(
        `/api/visa/file/${encodeURIComponent(fileId)}/financial-proof`,
        await getToken(),
        { method: 'POST', body: JSON.stringify(inputs) }
      ),

    /**
     * Run the Sponsor Evidence Module against an existing visa file.
     * Replaces generic sponsor_* items with richer spn_* items and persists
     * the inputs + warnings. Returns warnings and the updated file.
     */
    assessSponsorEvidence: async (fileId: string, inputs: SponsorEvidenceInputs) =>
      apiFetch<SponsorEvidenceResponse>(
        `/api/visa/file/${encodeURIComponent(fileId)}/sponsor-evidence`,
        await getToken(),
        { method: 'POST', body: JSON.stringify(inputs) }
      ),
  }
}

export type VisaFileApi = ReturnType<typeof createVisaFileApi>

// ---------------------------------------------------------------------------
// Action Plan API (Module A)
// ---------------------------------------------------------------------------

export function createActionPlanApi(getToken: () => Promise<string | null>) {
  return {
    /** Ranked action plan for the user's latest readiness check. */
    getLatest: async () =>
      apiFetch<ActionPlan>('/api/visa/action-plan', await getToken()),

    /** Ranked action plan for a specific readiness check. */
    getForCheck: async (checkId: string) =>
      apiFetch<ActionPlan>(
        `/api/visa/action-plan/${encodeURIComponent(checkId)}`,
        await getToken()
      ),
  }
}

export type ActionPlanApi = ReturnType<typeof createActionPlanApi>

// ---------------------------------------------------------------------------
// Timeline API (Module C)
// ---------------------------------------------------------------------------

export function createTimelineApi(getToken: () => Promise<string | null>) {
  return {
    /** The user's timeline. Throws ApiError 404 when none exists yet. */
    getTimeline: async () =>
      apiFetch<VisaTimeline>('/api/visa/timeline', await getToken()),

    /** Generate or regenerate the timeline from an intake date (+ optional country). */
    generateTimeline: async (intakeDate: string, country?: string) =>
      apiFetch<VisaTimeline>('/api/visa/timeline', await getToken(), {
        method: 'POST',
        body: JSON.stringify(country ? { intake_date: intakeDate, country } : { intake_date: intakeDate }),
      }),

    /** Edit one milestone's status and/or note; returns the recomputed timeline. */
    updateMilestone: async (milestoneId: string, update: MilestoneUpdate) =>
      apiFetch<VisaTimeline>('/api/visa/timeline/milestone', await getToken(), {
        method: 'PATCH',
        body: JSON.stringify({ milestone_id: milestoneId, ...update }),
      }),
  }
}

export type TimelineApi = ReturnType<typeof createTimelineApi>

// ---------------------------------------------------------------------------
// SOP Reviewer API (Module E)
// ---------------------------------------------------------------------------

export function createSopApi(getToken: () => Promise<string | null>) {
  return {
    /**
     * Get an AI review of an SOP. Throws ApiError 503 when AI isn't configured,
     * 429 when the daily quota is exhausted, 400 when the text is too short/long.
     */
    reviewSop: async (sopText: string, country?: string) =>
      apiFetch<SopReviewResponse>('/api/visa/sop/review', await getToken(), {
        method: 'POST',
        body: JSON.stringify(country ? { sop_text: sopText, country } : { sop_text: sopText }),
      }),

    getHistory: async () =>
      apiFetch<SopHistoryItem[]>('/api/visa/sop/history', await getToken()),
  }
}

export type SopApi = ReturnType<typeof createSopApi>

// ---------------------------------------------------------------------------
// Mock Interview API (Module F)
// ---------------------------------------------------------------------------

export function createInterviewApi(getToken: () => Promise<string | null>) {
  return {
    /** Start a session. Throws ApiError 503 (no AI), 429 (quota). */
    start: async (country?: string) =>
      apiFetch<InterviewSession>('/api/visa/interview/start', await getToken(), {
        method: 'POST',
        body: JSON.stringify(country ? { country } : {}),
      }),

    /** Answer the current question; returns the session with the next question. */
    reply: async (sessionId: string, answer: string) =>
      apiFetch<InterviewSession>(
        `/api/visa/interview/${encodeURIComponent(sessionId)}/reply`,
        await getToken(),
        { method: 'POST', body: JSON.stringify({ answer }) }
      ),

    /** End the session and get the credibility assessment. */
    finish: async (sessionId: string) =>
      apiFetch<InterviewSession>(
        `/api/visa/interview/${encodeURIComponent(sessionId)}/finish`,
        await getToken(),
        { method: 'POST', body: JSON.stringify({}) }
      ),
  }
}

export type InterviewApi = ReturnType<typeof createInterviewApi>

// ---------------------------------------------------------------------------
// Document Guidance API
// ---------------------------------------------------------------------------

export function createDocumentGuidanceApi(getToken: () => Promise<string | null>) {
  return {
    /** Ordered document plan for the given profile. */
    getPlan: async (profile: DocProfile) =>
      apiFetch<OrderedDocumentPlan>('/api/visa/documents/plan', await getToken(), {
        method: 'POST',
        body: JSON.stringify(profile),
      }),

    /** Save progress on a single document (have | in_progress | done). */
    updateState: async (documentId: string, status: string) =>
      apiFetch<{ document_id: string; status: string }>(
        '/api/visa/documents/state',
        await getToken(),
        { method: 'PATCH', body: JSON.stringify({ document_id: documentId, status }) }
      ),

    /** Flag a wrong fee / moved office. */
    submitCorrection: async (note: string, documentId?: string, officeId?: string) =>
      apiFetch<{ ok: boolean }>('/api/visa/documents/corrections', await getToken(), {
        method: 'POST',
        body: JSON.stringify({ note, document_id: documentId, office_id: officeId }),
      }),
  }
}

export type DocumentGuidanceApi = ReturnType<typeof createDocumentGuidanceApi>

// ---------------------------------------------------------------------------
// Bank Statement Checker API (manual entry)
// ---------------------------------------------------------------------------

export function createFinancialDocApi(getToken: () => Promise<string | null>) {
  return {
    /** Run the UK financial rules on the manually-entered statement values. */
    evaluate: async (
      statement: ManualStatement,
      context: DocEvaluateContext,
      country = 'uk',
    ) =>
      apiFetch<DocEvaluateResponse>(
        '/api/visa/documents/financial/evaluate',
        await getToken(),
        { method: 'POST', body: JSON.stringify({ statement, context, country }) },
      ),

    getHistory: async () =>
      apiFetch<DocHistoryItem[]>('/api/visa/documents/financial/history', await getToken()),
  }
}

export type FinancialDocApi = ReturnType<typeof createFinancialDocApi>

// ---------------------------------------------------------------------------
// Trust / Freshness API (Module 2)
// ---------------------------------------------------------------------------

export function createTrustApi(getToken: () => Promise<string | null>) {
  return {
    /** Freshness (last-reviewed status) for every destination. */
    getFreshness: async () =>
      apiFetch<CountryFreshness[]>('/api/visa/trust/freshness', await getToken()),

    /** Full rule changelog, newest first; optionally filtered to one country. */
    getChangelog: async (country?: string) =>
      apiFetch<ChangelogEntry[]>(
        `/api/visa/trust/changelog${country ? `?country=${encodeURIComponent(country)}` : ''}`,
        await getToken(),
      ),

    /** Rule changes new to this user for a country (since they last acknowledged). */
    getUpdates: async (country: string) =>
      apiFetch<TrustUpdates>(
        `/api/visa/trust/${encodeURIComponent(country)}/updates`,
        await getToken(),
      ),

    /** Mark the user caught up on a country's changes. */
    ack: async (country: string, upTo?: string) =>
      apiFetch<{ country: string; acked_to: string }>(
        `/api/visa/trust/${encodeURIComponent(country)}/ack`,
        await getToken(),
        { method: 'POST', body: JSON.stringify(upTo ? { up_to: upTo } : {}) },
      ),

    getPreferences: async () =>
      apiFetch<TrustPreferences>('/api/visa/trust/preferences', await getToken()),

    setPreferences: async (alertsOptIn: boolean) =>
      apiFetch<TrustPreferences>('/api/visa/trust/preferences', await getToken(), {
        method: 'POST',
        body: JSON.stringify({ alerts_opt_in: alertsOptIn }),
      }),
  }
}

export type TrustApi = ReturnType<typeof createTrustApi>

// ---------------------------------------------------------------------------
// Outcome loop API (Module 3)
// ---------------------------------------------------------------------------

export function createOutcomeApi(getToken: () => Promise<string | null>) {
  return {
    /** Should we ask this user to report their decision yet? */
    getPrompt: async () =>
      apiFetch<OutcomePrompt>('/api/visa/outcomes/prompt', await getToken()),

    /** Report a decision. refusalReasons only used when outcome === 'refused'. */
    report: async (
      outcome: VisaOutcomeKind,
      opts?: { country?: string; visaCheckId?: string; refusalReasons?: string[]; decidedAt?: string },
    ) =>
      apiFetch<{ id: string; outcome: string }>('/api/visa/outcomes', await getToken(), {
        method: 'POST',
        body: JSON.stringify({
          outcome,
          country: opts?.country,
          visa_check_id: opts?.visaCheckId,
          refusal_reasons: opts?.refusalReasons,
          decided_at: opts?.decidedAt,
        }),
      }),

    list: async () =>
      apiFetch<OutcomeRecord[]>('/api/visa/outcomes', await getToken()),

    /** Approval-rate-by-readiness across all users (social proof + calibration). */
    getStats: async () =>
      apiFetch<OutcomeStats>('/api/visa/outcomes/stats', await getToken()),
  }
}

export type OutcomeApi = ReturnType<typeof createOutcomeApi>

// ---------------------------------------------------------------------------
// Guided journey API (Module 4)
// ---------------------------------------------------------------------------

export function createJourneyApi(getToken: () => Promise<string | null>) {
  return {
    /** The single ordered "% ready to apply" spine + next action. */
    getJourney: async () =>
      apiFetch<Journey>('/api/visa/journey', await getToken()),
  }
}

export type JourneyApi = ReturnType<typeof createJourneyApi>

// ---------------------------------------------------------------------------
// Consultant / organization API (Module 5)
// ---------------------------------------------------------------------------

export function createOrgApi(getToken: () => Promise<string | null>) {
  return {
    /** Caller's workspace + role, or { org: null }. */
    getMyOrg: async () =>
      apiFetch<MyOrg>('/api/org/me', await getToken()),

    /** Create a workspace; caller becomes owner. 409 if already in one. */
    createOrg: async (name: string) =>
      apiFetch<{ org: { id: string; name: string; plan: string }; role: string }>(
        '/api/org', await getToken(),
        { method: 'POST', body: JSON.stringify({ name }) },
      ),

    /** Invite a student by email. 402 if seat limit reached. */
    inviteClient: async (email: string) =>
      apiFetch<{ id: string; email: string; status: string }>(
        '/api/org/clients', await getToken(),
        { method: 'POST', body: JSON.stringify({ email }) },
      ),

    listClients: async () =>
      apiFetch<{ clients: RosterClient[] }>('/api/org/clients', await getToken()),

    removeClient: async (clientId: string) =>
      apiFetch<{ id: string; status: string }>(
        `/api/org/clients/${encodeURIComponent(clientId)}`, await getToken(),
        { method: 'DELETE' },
      ),

    /** A specific client's full journey (only after they accept). */
    getClientJourney: async (clientId: string) =>
      apiFetch<ClientJourneyResponse>(
        `/api/org/clients/${encodeURIComponent(clientId)}/journey`, await getToken(),
      ),

    // ── Client (student) side ────────────────────────────────────────────────
    listInvitations: async () =>
      apiFetch<{ invitations: OrgInvitation[] }>('/api/org/invitations', await getToken()),

    acceptInvitation: async (invitationId: string) =>
      apiFetch<{ id: string; status: string }>(
        `/api/org/invitations/${encodeURIComponent(invitationId)}/accept`, await getToken(),
        { method: 'POST', body: JSON.stringify({}) },
      ),

    declineInvitation: async (invitationId: string) =>
      apiFetch<{ id: string; status: string }>(
        `/api/org/invitations/${encodeURIComponent(invitationId)}/decline`, await getToken(),
        { method: 'POST', body: JSON.stringify({}) },
      ),
  }
}

export type OrgApi = ReturnType<typeof createOrgApi>

// ---------------------------------------------------------------------------
// Readiness Report API
// ---------------------------------------------------------------------------

export interface ReportTokenResponse {
  token: string
  reportId: string
  narratedByAi: boolean
}

export interface ReportPdfUrl {
  url: string
  expiresAt: string
}

export function createReportApi(getToken: () => Promise<string | null>) {
  return {
    /**
     * Build (or return the cached) report for one of the caller's assessments.
     * Throws ApiError 403 (unpaid), 404 (unknown assessment), 503 (unavailable).
     */
    generate: async (assessmentId: string) =>
      apiFetch<ReportTokenResponse>(
        `/api/visa/assessments/${encodeURIComponent(assessmentId)}/report`,
        await getToken(),
        { method: 'POST', body: JSON.stringify({}) },
      ),

    /**
     * Fetch a report by token and VALIDATE it at the boundary (Zod) before it is
     * rendered / handed to the PDF route. Throws ApiError 404 (bad/foreign token),
     * 403 (plan lapsed), or ZodError on a malformed payload.
     */
    getReport: async (token: string): Promise<ReportData> => {
      const raw = await apiFetch<unknown>(
        `/api/visa/reports/${encodeURIComponent(token)}`,
        await getToken(),
      )
      return parseReportData(raw)
    },

    /**
     * Request a server-rendered PDF (Playwright) and get back a short-lived,
     * signed R2 URL to open. Throws ApiError 403/404 like the other report routes.
     */
    getPdfUrl: async (token: string) =>
      apiFetch<ReportPdfUrl>(
        `/api/visa/reports/${encodeURIComponent(token)}/pdf`,
        await getToken(),
      ),
  }
}

export type ReportApi = ReturnType<typeof createReportApi>

/**
 * Fetch report data using a single-use RENDER TOKEN instead of a Clerk session.
 * Used ONLY by the print route when loaded by the server-side Playwright step
 * (which has no Clerk login). The render token is the capability; no Bearer token
 * is sent. Validated at the boundary with Zod, same as the authenticated path.
 */
export async function fetchReportForRender(token: string, rt: string): Promise<ReportData> {
  let res: Response
  try {
    res = await fetch(
      `${API_BASE}/api/visa/reports/${encodeURIComponent(token)}/render?rt=${encodeURIComponent(rt)}`,
    )
  } catch {
    throw new ApiError('Could not reach the server.', 0)
  }
  if (!res.ok) {
    throw new ApiError(`Request failed (${res.status})`, res.status)
  }
  return parseReportData(await res.json())
}
