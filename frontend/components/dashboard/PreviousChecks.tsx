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
import { countryName, countryFlag, countryRoute, formatDate } from '@/lib/dashboardDisplay'
import { toneFromScore, toneTextClass } from '@/components/ui/StatusPill'
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
  return toneTextClass(toneFromScore(score))
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
      className={`overflow-hidden rounded-[4px] border bg-white transition-colors ${
        active ? 'border-l-2 border-l-stamp border-y-hairline border-r-hairline' : 'border-hairline'
      }`}
    >
      <div className="flex items-center gap-3 p-3 sm:p-3.5">
        {/* Country */}
        <span className="flex-shrink-0 text-xl">{countryFlag(item.country)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-body text-sm font-semibold text-ink">{countryName(item.country)}</p>
          <p className="truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-support">{countryRoute(item.country)}</p>
        </div>

        {/* Score + result */}
        <div className="flex-shrink-0 text-right">
          <span className={`font-mono text-base font-bold leading-none tabular-nums ${scoreColor(item.score)}`}>
            {item.score}
          </span>
          <p className="font-body text-[11px] leading-tight text-support">{item.result}</p>
        </div>

        {/* Date — hide on small screens */}
        <p className="hidden w-20 flex-shrink-0 text-right font-mono text-[10.5px] text-support sm:block">
          {formatDate(item.created_at)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 px-3 pb-3 sm:px-3.5">
        {active ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-body text-xs font-semibold text-stamp">
            <CheckCircle2 size={13} />
            Active file
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onBuildFile(item.id)}
            disabled={building}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            <FolderPlus size={12} />
            Build file from this check
          </button>
        )}

        <Link
          href={`/tools/student-visa/countries/${item.country}`}
          className="px-2 py-1.5 font-body text-xs font-medium text-support transition-colors hover:text-ink"
        >
          Retake
        </Link>

        <GenerateReportButton checkId={item.id} />

        {hasDetail && (
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="ml-auto inline-flex items-center gap-1 px-2 py-1.5 font-body text-xs text-support transition-colors hover:text-ink"
          >
            {open ? 'Hide' : 'View result'}
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {/* Detail */}
      {open && hasDetail && (
        <div className="space-y-2 border-t border-hairline px-3 pb-3.5 pt-3 sm:px-3.5">
          {item.result_description && (
            <p className="font-body text-xs text-support">{item.result_description}</p>
          )}
          {issues.length > 0 && (
            <ul className="space-y-1.5">
              {issues.map((iss, i) => (
                <li key={iss.question_id || i} className="flex items-start gap-2 font-body text-xs text-ink">
                  <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-seal-text" />
                  {iss.message}
                </li>
              ))}
            </ul>
          )}
          {recs.length > 0 && (
            <ul className="space-y-1.5">
              {recs.slice(0, 2).map((r, i) => (
                <li key={i} className="flex items-start gap-2 font-body text-xs text-ink">
                  <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-stamp" />
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
      <div className="mb-3 flex items-center gap-2">
        <History size={15} className="text-support" />
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-support">
          Previous checks
        </h2>
        {!loading && !error && checks.length > 0 && (
          <span className="font-mono text-xs text-support">({checks.length})</span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 size={18} className="animate-spin text-stamp" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-support">Loading your checks…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-[4px] border border-seal-text/40 bg-white p-5 text-center shadow-[6px_6px_0_0] shadow-ink/10">
          <AlertCircle size={20} className="mx-auto mb-2 text-seal-text" />
          <p className="mb-3 font-body text-sm text-ink">{error}</p>
          <button onClick={onRetry} className="btn-secondary inline-flex items-center justify-center gap-2 text-xs">
            <RefreshCw size={12} />
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && checks.length === 0 && (
        <div className="rounded-[4px] border border-hairline bg-white p-6 text-center shadow-[6px_6px_0_0] shadow-ink/10">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[4px] border border-hairline bg-paper">
            <ClipboardCheck size={22} className="text-stamp" />
          </div>
          <p className="mb-1 font-serif text-[17px] leading-tight text-ink">No checks yet</p>
          <p className="mx-auto mb-5 max-w-xs font-body text-xs text-support">
            Run your first Student Visa Readiness Check to see your score and history here.
          </p>
          <Link href="/tools/student-visa/countries" className="btn-primary text-sm">
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
