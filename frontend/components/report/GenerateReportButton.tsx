'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2 } from 'lucide-react'
import { useReportApi } from '@/lib/useReportApi'
import { ApiError } from '@/lib/api'

/**
 * Generates (or reuses) the Readiness Report for a given assessment and navigates
 * to it. This is the app's entry point into the report feature. Paywall-aware:
 * a 403 surfaces an upgrade prompt rather than a raw error.
 */
export function GenerateReportButton({
  checkId,
  className,
}: {
  checkId: string
  className?: string
}) {
  const router = useRouter()
  const api = useReportApi()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const { token } = await api.generate(checkId)
      router.push(`/report/${token}`)
      // Intentionally leave `loading` true — we are navigating away.
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setError('Available on a paid plan.')
      } else if (e instanceof ApiError && e.status === 401) {
        setError('Please sign in to continue.')
      } else {
        setError(
          e instanceof ApiError ? e.message : 'Could not generate the report. Please try again.',
        )
      }
      setLoading(false)
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={className ?? 'btn-secondary px-3 py-1.5 text-xs'}
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
        {loading ? 'Generating…' : 'Get readiness report'}
      </button>
      {error && <span className="mt-1 font-body text-[11px] text-seal-text">{error}</span>}
    </span>
  )
}
