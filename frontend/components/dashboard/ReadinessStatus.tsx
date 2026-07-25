'use client'

import Link from 'next/link'
import {
  Gauge,
  ArrowRight,
  RefreshCw,
  FolderPlus,
  AlertTriangle,
  ShieldAlert,
  Info,
  ClipboardCheck,
} from 'lucide-react'
import type { HistoryItem, ResultIssue } from '@/types/visa'
import { countryName, countryFlag, formatDate } from '@/lib/dashboardDisplay'
import { toneFromScore, toneTextClass } from '@/components/ui/StatusPill'

interface Props {
  latestCheck: HistoryItem | null
  /** Build / open the visa file from this readiness result. */
  onBuildFile: (checkId: string) => void
  building?: boolean
}

// ── Score colour (band-derived, mirrors HistoryResultCard) ───────────────────

function scoreColor(score: number): string {
  return toneTextClass(toneFromScore(score))
}

function scoreRingBg(score: number): string {
  return toneFromScore(score) === 'positive'
    ? 'border-stamp/40 bg-stamp/[0.06]'
    : 'border-seal-text/40 bg-seal/[0.06]'
}

// Collect the top issues across blocker → high-risk → soft, capped at 3.
function topIssues(check: HistoryItem): { issue: ResultIssue; kind: 'blocker' | 'flag' | 'soft' }[] {
  const out: { issue: ResultIssue; kind: 'blocker' | 'flag' | 'soft' }[] = []
  for (const i of check.critical_blockers ?? []) out.push({ issue: i, kind: 'blocker' })
  for (const i of check.high_risk_flags ?? []) out.push({ issue: i, kind: 'flag' })
  for (const i of check.soft_warnings ?? []) out.push({ issue: i, kind: 'soft' })
  return out.slice(0, 3)
}

const KIND_ICON = {
  blocker: AlertTriangle,
  flag: ShieldAlert,
  soft: Info,
}
const KIND_COLOR = {
  blocker: 'text-seal-text',
  flag: 'text-seal-text',
  soft: 'text-support',
}

// ── Component ────────────────────────────────────────────────────────────────

export function ReadinessStatus({ latestCheck, onBuildFile, building }: Props) {
  // ── Empty state ────────────────────────────────────────────────────────────
  if (!latestCheck) {
    return (
      <section className="rounded-[4px] border border-hairline bg-white p-6 shadow-[6px_6px_0_0] shadow-ink/10">
        <div className="mb-4 flex items-center gap-2">
          <Gauge size={16} className="text-stamp" />
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
            Readiness status
          </h2>
        </div>
        <div className="py-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[4px] border border-hairline bg-paper">
            <ClipboardCheck size={22} className="text-stamp" />
          </div>
          <p className="mb-1 font-serif text-[17px] leading-tight text-ink">
            You haven&apos;t checked your visa readiness yet
          </p>
          <p className="mx-auto mb-5 max-w-xs font-body text-xs text-support">
            Run the Student Visa Readiness Checker to get a score, see your blockers, and
            unlock your personalised visa file.
          </p>
          <Link href="/tools/student-visa/countries" className="btn-primary text-sm">
            Start readiness check
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    )
  }

  // ── Populated state ────────────────────────────────────────────────────────
  const issues = topIssues(latestCheck)
  const issueCount =
    (latestCheck.critical_blockers?.length ?? 0) +
    (latestCheck.high_risk_flags?.length ?? 0) +
    (latestCheck.soft_warnings?.length ?? 0)

  return (
    <section className="rounded-[4px] border border-hairline bg-white p-5 shadow-[6px_6px_0_0] shadow-ink/10 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-stamp" />
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
            Latest readiness status
          </h2>
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-support">{formatDate(latestCheck.created_at)}</span>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row">
        {/* Score block */}
        <div className="flex flex-shrink-0 items-center gap-4 sm:w-32 sm:flex-col sm:gap-2">
          <div
            className={`flex h-24 w-24 flex-col items-center justify-center rounded-[4px] border-2 ${scoreRingBg(latestCheck.score)}`}
          >
            <span className={`font-mono text-3xl font-bold leading-none tabular-nums ${scoreColor(latestCheck.score)}`}>
              {latestCheck.score}
            </span>
            <span className="mt-0.5 font-mono text-[10px] font-medium text-support">/ 100</span>
          </div>
          <div className="text-center">
            <p className="font-body text-sm font-bold text-ink">{latestCheck.result}</p>
            <p className="mt-0.5 flex items-center justify-center gap-1 font-body text-xs text-support">
              <span>{countryFlag(latestCheck.country)}</span>
              {countryName(latestCheck.country)}
            </p>
          </div>
        </div>

        {/* Issues + actions */}
        <div className="min-w-0 flex-1">
          {issues.length > 0 ? (
            <>
              <p className="mb-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-support">
                Top issues to resolve {issueCount > 3 && <span className="text-support">(+{issueCount - 3} more)</span>}
              </p>
              <ul className="mb-4 space-y-2">
                {issues.map(({ issue, kind }, i) => {
                  const Icon = KIND_ICON[kind]
                  return (
                    <li key={issue.question_id || i} className="flex items-start gap-2 font-body text-sm">
                      <Icon size={14} className={`${KIND_COLOR[kind]} mt-0.5 flex-shrink-0`} />
                      <span className="leading-snug text-ink">{issue.message}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="mb-4 flex items-start gap-2 font-body text-sm text-ink">
              <ClipboardCheck size={15} className="mt-0.5 flex-shrink-0 text-stamp" />
              No blockers or high-risk flags were raised — keep your documents ready.
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onBuildFile(latestCheck.id)}
              disabled={building}
              className="btn-primary px-3.5 py-2 text-xs"
            >
              <FolderPlus size={13} />
              Build visa file from this result
            </button>
            <Link
              href={`/tools/student-visa/countries/${latestCheck.country}`}
              className="btn-secondary px-3.5 py-2 text-xs"
            >
              <RefreshCw size={13} />
              Retake check
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
