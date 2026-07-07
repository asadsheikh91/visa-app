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
import { tierFromScore } from '@/types/visa'
import { countryName, countryFlag, formatDate } from '@/lib/dashboardDisplay'

interface Props {
  latestCheck: HistoryItem | null
  /** Build / open the visa file from this readiness result. */
  onBuildFile: (checkId: string) => void
  building?: boolean
}

// ── Score colour (band-derived, mirrors HistoryResultCard) ───────────────────

function scoreColor(score: number): string {
  const t = tierFromScore(score)
  if (t === 'ready') return 'text-emerald-400'
  if (t === 'mostly_ready') return 'text-brand-400'
  if (t === 'needs_work') return 'text-amber-400'
  return 'text-red-400'
}

function scoreRingBg(score: number): string {
  const t = tierFromScore(score)
  if (t === 'ready') return 'border-emerald-500/30 bg-emerald-500/5'
  if (t === 'mostly_ready') return 'border-brand-500/30 bg-brand-500/5'
  if (t === 'needs_work') return 'border-amber-500/30 bg-amber-500/5'
  return 'border-red-500/30 bg-red-500/5'
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
  blocker: 'text-red-400',
  flag: 'text-orange-400',
  soft: 'text-yellow-400',
}

// ── Component ────────────────────────────────────────────────────────────────

export function ReadinessStatus({ latestCheck, onBuildFile, building }: Props) {
  // ── Empty state ────────────────────────────────────────────────────────────
  if (!latestCheck) {
    return (
      <section className="glass rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gauge size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Readiness status
          </h2>
        </div>
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
            <ClipboardCheck size={22} className="text-slate-500" />
          </div>
          <p className="text-white font-medium text-sm mb-1">
            You haven&apos;t checked your visa readiness yet
          </p>
          <p className="text-slate-500 text-xs mb-5 max-w-xs mx-auto">
            Run the Student Visa Readiness Checker to get a score, see your blockers, and
            unlock your personalised visa file.
          </p>
          <Link href="/tools/student-visa/countries" className="btn-primary text-sm justify-center">
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
    <section className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Latest readiness status
          </h2>
        </div>
        <span className="text-xs text-slate-500">{formatDate(latestCheck.created_at)}</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-5">
        {/* Score block */}
        <div className="flex sm:flex-col items-center gap-4 sm:gap-2 sm:w-32 flex-shrink-0">
          <div
            className={`w-24 h-24 rounded-2xl border-2 flex flex-col items-center justify-center ${scoreRingBg(latestCheck.score)}`}
          >
            <span className={`text-3xl font-extrabold leading-none ${scoreColor(latestCheck.score)}`}>
              {latestCheck.score}
            </span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5">/ 100</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-white">{latestCheck.result}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1 justify-center mt-0.5">
              <span>{countryFlag(latestCheck.country)}</span>
              {countryName(latestCheck.country)}
            </p>
          </div>
        </div>

        {/* Issues + actions */}
        <div className="flex-1 min-w-0">
          {issues.length > 0 ? (
            <>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Top issues to resolve {issueCount > 3 && <span className="text-slate-600">(+{issueCount - 3} more)</span>}
              </p>
              <ul className="space-y-2 mb-4">
                {issues.map(({ issue, kind }, i) => {
                  const Icon = KIND_ICON[kind]
                  return (
                    <li key={issue.question_id || i} className="flex items-start gap-2 text-sm">
                      <Icon size={14} className={`${KIND_COLOR[kind]} flex-shrink-0 mt-0.5`} />
                      <span className="text-slate-300 leading-snug">{issue.message}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-emerald-300/90 mb-4 flex items-start gap-2">
              <ClipboardCheck size={15} className="flex-shrink-0 mt-0.5 text-emerald-400" />
              No blockers or high-risk flags were raised — keep your documents ready.
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onBuildFile(latestCheck.id)}
              disabled={building}
              className="btn-primary text-xs py-2 px-3.5"
            >
              <FolderPlus size={13} />
              Build visa file from this result
            </button>
            <Link
              href={`/tools/student-visa/countries/${latestCheck.country}`}
              className="btn-secondary text-xs py-2 px-3.5"
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
