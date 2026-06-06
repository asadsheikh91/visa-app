import type { CountryMeta, CheckResult, QuestionsResponse, HistoryItem, AnswerValue } from '@/types/visa'

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
  }
}

export type VisaApi = ReturnType<typeof createVisaApi>
