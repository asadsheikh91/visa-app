'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Info, ArrowRight, RefreshCw, ShieldAlert, FileText, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CheckResult, ResultIssue } from '@/types/visa'
import Link from 'next/link'
import { DocCard } from '@/components/ui/DocCard'
import { ScoreBlock } from '@/components/ui/ScoreBlock'
import { StatusPill, type StatusTone, toneTextClass } from '@/components/ui/StatusPill'
import { SourcesUsedList } from '@/components/checker/SourcesUsedList'
import { useReportApi } from '@/lib/useReportApi'
import { ApiError } from '@/lib/api'

interface Props {
  result: CheckResult
  onRetry: () => void
}

/**
 * Post-check prompt: invites the user to generate + open their full readiness
 * report. Shown only when the check was saved (result.id present). Generating is
 * idempotent server-side; re-viewing an existing report doesn't consume budget.
 */
function ReportPrompt({ assessmentId }: { assessmentId: string }) {
  const reportApi = useReportApi()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onView = async () => {
    setLoading(true)
    setError(null)
    try {
      const { token } = await reportApi.generate(assessmentId)
      router.push(`/report/${token}`)
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setError("You've used all your free readiness reports. Visit your dashboard to manage them.")
      } else if (e instanceof ApiError && e.status === 503) {
        setError('Report generation is temporarily unavailable. Please try again shortly.')
      } else {
        setError(e instanceof ApiError ? e.message : 'Could not open your report. Please try again.')
      }
      setLoading(false)
    }
  }

  return (
    <DocCard>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[4px] border border-hairline bg-paper">
            <FileText size={17} className="text-stamp" aria-hidden="true" />
          </span>
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">Your check is complete</p>
            <p className="mt-1 font-body text-[13.5px] leading-relaxed text-support">
              Get your full readiness report — findings, fixes and an official-source roadmap in one document.
            </p>
          </div>
        </div>
        <button onClick={onView} disabled={loading} className="btn-primary flex-shrink-0 text-sm">
          {loading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
          {loading ? 'Preparing…' : 'View full report'}
          {!loading && <ArrowRight size={15} aria-hidden="true" />}
        </button>
      </div>
      {error && (
        <div role="alert" className="mt-3 flex items-start gap-2 rounded-[3px] border border-seal-text/40 bg-seal/[0.06] p-3">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-seal-text" aria-hidden="true" />
          <p className="font-body text-[13px] text-seal-text">{error}</p>
        </div>
      )}
    </DocCard>
  )
}

const countryLabels: Record<string, string> = {
  uk: 'United Kingdom',
  usa: 'United States',
  canada: 'Canada',
  australia: 'Australia',
}

function IssueList({ items }: { items: ResultIssue[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={item.question_id || i} className="flex items-start gap-2.5 font-body text-[14px] text-ink">
          <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-support" />
          <span>{item.message}</span>
        </li>
      ))}
    </ul>
  )
}

/** A titled findings block — mono header row with a tone-coloured count stamp. */
function FindingsBlock({
  title,
  tone,
  count,
  note,
  icon: Icon,
  children,
}: {
  title: string
  tone: StatusTone
  count: number
  note?: string
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <DocCard padded={false}>
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-6 py-3.5">
        <span className="flex items-center gap-2">
          <Icon size={15} className={toneTextClass(tone)} aria-hidden={true} />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">{title}</span>
        </span>
        <StatusPill tone={tone}>{count}</StatusPill>
      </div>
      <div className="px-6 py-5">
        {note && <p className="mb-3 font-body text-[12.5px] leading-relaxed text-support">{note}</p>}
        {children}
      </div>
    </DocCard>
  )
}

export function ResultCard({ result, onRetry }: Props) {
  const countryName  = countryLabels[result.country] || result.country
  const visaTypeLabel = result.visa_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const blockers      = result.critical_blockers     ?? []
  const highRiskFlags = result.high_risk_flags        ?? []
  const softWarnings  = result.soft_warnings          ?? []
  const warnings      = result.warnings               ?? []
  const recs          = result.recommendations        ?? []
  const sources        = result.sources_used             ?? []

  return (
    <div className="space-y-6">
      {/* Score header */}
      <DocCard perforated>
        <div className="border-b border-hairline pb-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink">
            Readiness assessment
          </span>
        </div>

        <dl className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-support">Route</dt>
            <dd className="text-right font-mono text-[12px] font-medium text-ink">{countryName}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-support">Program</dt>
            <dd className="text-right font-mono text-[12px] font-medium text-ink">{visaTypeLabel}</dd>
          </div>
        </dl>

        <div className="mt-5 border-t border-hairline pt-5">
          <ScoreBlock score={result.score} label={result.result} />
        </div>

        {result.result_description && (
          <p className="mt-5 border-t border-hairline pt-4 font-body text-[14px] leading-relaxed text-support">
            {result.result_description}
          </p>
        )}
      </DocCard>

      {result.id === null && (
        <div className="rounded-[3px] border border-seal-text/40 bg-seal/[0.06] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-seal-text" aria-hidden="true" />
            <p className="font-body text-[13.5px] text-ink">
              Your score was calculated, but it was not saved to your dashboard. Please try again in a moment.
            </p>
          </div>
        </div>
      )}

      {/* Post-check prompt to view the full report (only when the check was saved) */}
      {result.id && <ReportPrompt assessmentId={result.id} />}

      {/* Critical blockers */}
      {blockers.length > 0 && (
        <FindingsBlock
          title="Critical blockers"
          tone="blocker"
          count={blockers.length}
          icon={AlertTriangle}
          note="These issues will likely cause a visa refusal. Fix them before applying."
        >
          <IssueList items={blockers} />
        </FindingsBlock>
      )}

      {/* High-risk flags */}
      {highRiskFlags.length > 0 && (
        <FindingsBlock
          title="High-risk flags"
          tone="risk"
          count={highRiskFlags.length}
          icon={ShieldAlert}
          note="These factors increase refusal risk. Resolve them before lodging."
        >
          <IssueList items={highRiskFlags} />
        </FindingsBlock>
      )}

      {/* Soft warnings */}
      {softWarnings.length > 0 && (
        <FindingsBlock title="Advisory notices" tone="advisory" count={softWarnings.length} icon={Info}>
          <IssueList items={softWarnings} />
        </FindingsBlock>
      )}

      {/* Auto-computed per-question warnings */}
      {warnings.length > 0 && (
        <FindingsBlock title="Warnings" tone="advisory" count={warnings.length} icon={Info}>
          <IssueList items={warnings} />
        </FindingsBlock>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <FindingsBlock title="Recommendations" tone="positive" count={recs.length} icon={CheckCircle2}>
          <ul className="space-y-2">
            {recs.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 font-body text-[14px] text-ink">
                <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-stamp" />
                {item}
              </li>
            ))}
          </ul>
        </FindingsBlock>
      )}

      {/* Sources / citations */}
      {sources.length > 0 && (
        <SourcesUsedList sources={sources} />
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <button onClick={onRetry} className="btn-secondary flex-1">
          <RefreshCw size={15} aria-hidden="true" />
          Retake this check
        </button>
        <Link href="/tools/student-visa/countries" className="btn-primary flex-1">
          Check another country
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <p className="text-center font-body text-[12px] leading-relaxed text-support">
        This is an informational readiness check, not legal advice. Requirements may change — always verify with the official visa authority.
      </p>
    </div>
  )
}
