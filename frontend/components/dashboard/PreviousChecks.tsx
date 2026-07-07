'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  History,
  Loader2,
  AlertCircle,
  RefreshCw,
  FolderPlus,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react'
import type { HistoryItem } from '@/types/visa'
import { tierFromScore } from '@/types/visa'
import { countryName, countryFlag, countryRoute, formatDate } from '@/lib/dashboardDisplay'
import { GenerateReportButton } from '@/components/report/GenerateReportButton'

interface Props {
  checks: HistoryItem[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onBuildFile: (checkId: string) => void
  /** The check whose file is currently shown in the builder, if any. */
  activeCheckId?: string | null
  building?: boolean
}

// ── Score colour ─────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  const t = tierFromScore(score)
  if (t === 'ready') return 'text-emerald-400'
  if (t === 'mostly_ready') return 'text-brand-400'
  if (t === 'needs_work') return 'text-amber-400'
  return 'text-red-400'
}

// ── One row ──────────────────────────────────────────────────────────────────

function CheckRow({
  item,
  active,
  building,
  onBuildFile,
}: {
  item: HistoryItem
  active: boolean
  building?: boolean
  onBuildFile: (checkId: string) => void
}) {
  const [open, setOpen] = useState(false)

  const issues = [
    ...(item.critical_blockers ?? []),
    ...(item.high_risk_flags ?? []),
  ].slice(0, 3)
  const recs = item.recommendations ?? []
  const hasDetail = issues.length > 0 || recs.length > 0 || !!item.result_description

  return (
    <li
      className={`rounded-xl border bg-white/[0.02] overflow-hidden transition-colors ${
        active ? 'border-brand-500/40' : 'border-white/10'
      }`}
    >
      <div className="flex items-center gap-3 p-3 sm:p-3.5">
        {/* Country */}
        <span className="text-xl flex-shrink-0">{countryFlag(item.country)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{countryName(item.country)}</p>
          <p className="text-xs text-slate-500 truncate">{countryRoute(item.country)}</p>
        </div>

        {/* Score + result */}
        <div className="text-right flex-shrink-0">
          <span className={`text-base font-extrabold leading-none ${scoreColor(item.score)}`}>
            {item.score}
          </span>
          <p className="text-[11px] text-slate-400 leading-tight">{item.result}</p>
        </div>

        {/* Date — hide on small screens */}
        <p className="hidden sm:block text-xs text-slate-500 w-20 text-right flex-shrink-0">
          {formatDate(item.created_at)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 sm:px-3.5 pb-3 flex-wrap">
        {active ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-300 px-2.5 py-1.5">
            <CheckCircle2 size={13} />
            Active file
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onBuildFile(item.id)}
            disabled={building}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            <FolderPlus size={12} />
            Build file from this check
          </button>
        )}

        <Link
          href={`/tools/student-visa/countries/${item.country}`}
          className="text-xs font-medium text-slate-400 hover:text-slate-200 px-2 py-1.5 transition-colors"
        >
          Retake
        </Link>

        <GenerateReportButton checkId={item.id} />

        {hasDetail && (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5 transition-colors"
          >
            {open ? 'Hide' : 'View result'}
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {/* Detail */}
      {open && hasDetail && (
        <div className="px-3 sm:px-3.5 pb-3.5 border-t border-white/10 pt-3 space-y-2">
          {item.result_description && (
            <p className="text-xs text-slate-400">{item.result_description}</p>
          )}
          {issues.length > 0 && (
            <ul className="space-y-1.5">
              {issues.map((iss, i) => (
                <li key={iss.question_id || i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                  {iss.message}
                </li>
              ))}
            </ul>
          )}
          {recs.length > 0 && (
            <ul className="space-y-1.5">
              {recs.slice(0, 2).map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-brand-200">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-brand-400 flex-shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function PreviousChecks({
  checks,
  loading,
  error,
  onRetry,
  onBuildFile,
  activeCheckId,
  building,
}: Props) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <History size={15} className="text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Previous checks
        </h2>
        {!loading && !error && checks.length > 0 && (
          <span className="text-xs text-slate-600">({checks.length})</span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-3">
          <Loader2 size={18} className="text-brand-400 animate-spin" />
          <span className="text-slate-500 text-sm">Loading your checks…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="glass rounded-2xl p-5 text-center border border-red-500/20">
          <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-red-300 text-sm mb-3">{error}</p>
          <button onClick={onRetry} className="btn-secondary text-xs inline-flex items-center gap-2 justify-center">
            <RefreshCw size={12} />
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && checks.length === 0 && (
        <div className="glass rounded-2xl p-6 text-center border border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
            <ClipboardCheck size={22} className="text-slate-500" />
          </div>
          <p className="text-white font-medium text-sm mb-1">No checks yet</p>
          <p className="text-slate-500 text-xs mb-5 max-w-xs mx-auto">
            Run your first Student Visa Readiness Check to see your score and history here.
          </p>
          <Link href="/tools/student-visa/countries" className="btn-primary text-sm justify-center">
            Start readiness check <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* List */}
      {!loading && !error && checks.length > 0 && (
        <ul className="space-y-2.5">
          {checks.map(item => (
            <CheckRow
              key={item.id}
              item={item}
              active={activeCheckId === item.id}
              building={building}
              onBuildFile={onBuildFile}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
