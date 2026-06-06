'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Info,
  ShieldAlert,
  ArrowRight,
  FileText,
} from 'lucide-react'
import type { HistoryItem, ResultIssue } from '@/types/visa'
import { tierFromScore } from '@/types/visa'
import { SourcesUsedList } from '@/components/checker/SourcesUsedList'

// ── Country display helpers ──────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  uk: '🇬🇧', usa: '🇺🇸', canada: '🇨🇦', australia: '🇦🇺',
}
const COUNTRY_NAMES: Record<string, string> = {
  uk: 'United Kingdom', usa: 'United States', canada: 'Canada', australia: 'Australia',
}
const VISA_ROUTES: Record<string, string> = {
  uk: 'Student Visa',
  usa: 'F-1 Student Visa',
  canada: 'Study Permit',
  australia: 'Student Visa Subclass 500',
}

// ── Score colour helpers ─────────────────────────────────────────────────────

function scoreColor(score: number): string {
  const t = tierFromScore(score)
  if (t === 'ready') return 'text-emerald-400'
  if (t === 'mostly_ready') return 'text-brand-400'
  if (t === 'needs_work') return 'text-amber-400'
  return 'text-red-400'
}

function scoreBg(score: number): string {
  const t = tierFromScore(score)
  if (t === 'ready') return 'bg-emerald-500/15 border-emerald-500/25'
  if (t === 'mostly_ready') return 'bg-brand-500/15 border-brand-500/25'
  if (t === 'needs_work') return 'bg-amber-500/15 border-amber-500/25'
  return 'bg-red-500/15 border-red-500/25'
}

// ── Formatting ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/** Converts a normalized_answers value to a display string. Arrays become
 *  comma-separated; plain objects are JSON-stringified rather than [object Object]. */
function formatAnswerValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (Array.isArray(v)) return v.map(String).join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// ── Sub-components ───────────────────────────────────────────────────────────

function IssueList({ items }: { items: ResultIssue[] }) {
  return (
    <ul className="space-y-2 mt-2">
      {items.map((item, i) => (
        <li key={item.question_id || i} className="flex items-start gap-2.5 text-sm">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 opacity-60" />
          <span>{item.message}</span>
        </li>
      ))}
    </ul>
  )
}

function NormalizedAnswers({ answers }: { answers: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(answers)

  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen((o: boolean) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span className="flex items-center gap-2">
          <FileText size={14} aria-hidden="true" />
          Submitted Answers
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          {entries.length === 0 ? (
            <p className="text-xs text-slate-500">No submitted answer snapshot available.</p>
          ) : (
            <dl className="space-y-1.5">
              {entries.map(([key, val]) => (
                <div key={key} className="flex gap-3 text-xs flex-wrap">
                  <dt className="text-slate-500 font-medium min-w-0 break-all">{key}</dt>
                  <dd className="text-slate-300 min-w-0 break-all">{formatAnswerValue(val)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  )
}


// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  item: HistoryItem
}

export function HistoryResultCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false)

  const blockers  = item.critical_blockers  ?? []
  const highRisk  = item.high_risk_flags    ?? []
  const soft      = item.soft_warnings      ?? []
  const warnings  = item.warnings           ?? []
  const recs      = item.recommendations    ?? []
  const answers   = item.normalized_answers ?? {}
  const sources   = item.sources_used       ?? []

  const hasDetails =
    blockers.length > 0 ||
    highRisk.length > 0 ||
    soft.length > 0 ||
    warnings.length > 0 ||
    recs.length > 0 ||
    Object.keys(answers).length > 0 ||
    sources.length > 0

  return (
    <div className="glass rounded-2xl border border-white/10 hover:border-white/20 transition-colors overflow-hidden">

      {/* ── Summary row ─────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">

        {/* Country */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-2xl leading-none flex-shrink-0" aria-hidden="true">
            {COUNTRY_FLAGS[item.country] ?? '🌐'}
          </span>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">
              {COUNTRY_NAMES[item.country] ?? item.country}
            </p>
            <p className="text-slate-500 text-xs truncate">
              {VISA_ROUTES[item.country] ?? item.visa_type.replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        {/* Score badge */}
        <div
          className={`flex-shrink-0 inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 ${scoreBg(item.score)}`}
        >
          <span className={`text-lg font-extrabold leading-none ${scoreColor(item.score)}`}>
            {item.score}
          </span>
          <span className="text-xs text-slate-400 font-medium">{item.result}</span>
        </div>

        {/* Date */}
        <p className="flex-shrink-0 text-xs text-slate-500 sm:w-28 sm:text-right">
          {formatDate(item.created_at)}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded((o: boolean) => !o)}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
            >
              {expanded ? 'Hide' : 'Details'}
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
          <Link
            href={`/tools/student-visa/countries/${item.country}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors whitespace-nowrap"
          >
            Retake <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* ── Expanded detail panel ────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-white/10 pt-4">

          {/* Result description */}
          {item.result_description && (
            <p className="text-slate-400 text-sm">{item.result_description}</p>
          )}

          {/* Critical blockers */}
          {blockers.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-red-200">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-red-400" aria-hidden="true" />
                <h5 className="text-xs font-bold text-red-300">
                  Critical Blockers ({blockers.length})
                </h5>
              </div>
              <IssueList items={blockers} />
            </div>
          )}

          {/* High-risk flags */}
          {highRisk.length > 0 && (
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-orange-200">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert size={14} className="text-orange-400" aria-hidden="true" />
                <h5 className="text-xs font-bold text-orange-300">
                  High-Risk Flags ({highRisk.length})
                </h5>
              </div>
              <IssueList items={highRisk} />
            </div>
          )}

          {/* Soft warnings */}
          {soft.length > 0 && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-yellow-200">
              <div className="flex items-center gap-2 mb-1">
                <Info size={14} className="text-yellow-400" aria-hidden="true" />
                <h5 className="text-xs font-bold text-yellow-300">
                  Advisory Notices ({soft.length})
                </h5>
              </div>
              <IssueList items={soft} />
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-200">
              <div className="flex items-center gap-2 mb-1">
                <Info size={14} className="text-amber-400" aria-hidden="true" />
                <h5 className="text-xs font-bold text-amber-300">
                  Warnings ({warnings.length})
                </h5>
              </div>
              <IssueList items={warnings} />
            </div>
          )}

          {/* Recommendations */}
          {recs.length > 0 && (
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 text-brand-200">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={14} className="text-brand-400" aria-hidden="true" />
                <h5 className="text-xs font-bold text-brand-300">
                  Recommendations ({recs.length})
                </h5>
              </div>
              <ul className="space-y-2 mt-2">
                {recs.map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Normalized answers — collapsible */}
          <NormalizedAnswers answers={answers} />

          {/* Sources */}
          <SourcesUsedList sources={sources} compact />
        </div>
      )}
    </div>
  )
}
