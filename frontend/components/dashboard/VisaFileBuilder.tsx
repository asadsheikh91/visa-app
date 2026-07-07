'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FolderOpen,
  Loader2,
  AlertCircle,
  RefreshCw,
  Lock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'
import type { VisaFile, ChecklistItem, ChecklistStatus } from '@/types/visa'
import { countryName, countryFlag } from '@/lib/dashboardDisplay'
import { ChecklistItemRow } from './ChecklistItemRow'

interface Props {
  file: VisaFile | null
  loading: boolean
  error: string | null
  /** No readiness check exists yet — the builder is locked. */
  locked: boolean
  savingItemId: string | null
  onRetry: () => void
  onStatusChange: (itemId: string, status: ChecklistStatus) => void
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-brand-500' : 'bg-amber-500'
  return (
    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
    </div>
  )
}

function StatPill({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-extrabold leading-none ${tone}`}>{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-1">{label}</p>
    </div>
  )
}

// ── Category section (collapsible) ───────────────────────────────────────────

function CategorySection({
  label,
  items,
  completed,
  criticalMissing,
  savingItemId,
  onStatusChange,
}: {
  label: string
  items: ChecklistItem[]
  completed: number
  criticalMissing: number
  savingItemId: string | null
  onStatusChange: (itemId: string, status: ChecklistStatus) => void
}) {
  const [open, setOpen] = useState(true)
  const allDone = completed === items.length

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {allDone ? (
            <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
          ) : (
            <FolderOpen size={16} className="text-slate-400 flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-white truncate">{label}</span>
          {criticalMissing > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-red-500/25 bg-red-500/10 text-red-300 flex-shrink-0">
              {criticalMissing} critical
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-500">
            {completed}/{items.length}
          </span>
          {open ? (
            <ChevronUp size={14} className="text-slate-500" />
          ) : (
            <ChevronDown size={14} className="text-slate-500" />
          )}
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-2.5">
          {items.map(item => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              onStatusChange={onStatusChange}
              saving={savingItemId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function VisaFileBuilder({
  file,
  loading,
  error,
  locked,
  savingItemId,
  onRetry,
  onStatusChange,
}: Props) {
  // ── Locked (no readiness check yet) ────────────────────────────────────────
  if (locked) {
    return (
      <section className="glass rounded-2xl border border-white/10 p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
          <Lock size={20} className="text-slate-500" />
        </div>
        <h2 className="text-white font-semibold text-sm mb-1">Your visa file is locked</h2>
        <p className="text-slate-500 text-xs max-w-sm mx-auto mb-5">
          Run your first readiness check and we&apos;ll generate a personalised document
          file — every item tailored to your country, funding, and background.
        </p>
        <Link href="/tools/student-visa/countries" className="btn-primary text-sm justify-center">
          <Sparkles size={14} />
          Start a readiness check
        </Link>
      </section>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="glass rounded-2xl border border-white/10 p-10 flex flex-col items-center justify-center gap-3">
        <Loader2 size={26} className="text-brand-400 animate-spin" />
        <p className="text-slate-500 text-sm">Building your personalised visa file…</p>
      </section>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !file) {
    return (
      <section className="glass rounded-2xl border border-red-500/20 p-6 text-center">
        <AlertCircle size={24} className="text-red-400 mx-auto mb-3" />
        <p className="text-red-300 text-sm mb-4">
          {error || 'Could not load your visa file.'}
        </p>
        <button onClick={onRetry} className="btn-secondary text-sm inline-flex items-center gap-2 justify-center">
          <RefreshCw size={14} />
          Try again
        </button>
      </section>
    )
  }

  // ── Loaded ─────────────────────────────────────────────────────────────────
  const { stats, categories, items, next_actions } = file

  // Group items by category for rendering, preserving category_meta order.
  const itemsByCat = new Map<string, ChecklistItem[]>()
  for (const it of items) {
    const arr = itemsByCat.get(it.category) ?? []
    arr.push(it)
    itemsByCat.set(it.category, arr)
  }

  return (
    <section className="space-y-4">
      {/* Header / progress */}
      <div className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl">{countryFlag(file.country)}</span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                {countryName(file.country)} Visa File
              </h2>
              <p className="text-xs text-slate-500">
                {stats.total_items} documents · {stats.completion_pct}% complete
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="text-2xl font-extrabold text-white">{stats.completion_pct}%</span>
          </div>
        </div>

        <ProgressBar pct={stats.completion_pct} />

        {/* Stat row */}
        <div className="grid grid-cols-4 gap-2 mt-5">
          <StatPill value={stats.completed} label="Ready" tone="text-emerald-400" />
          <StatPill value={stats.missing_total} label="Outstanding" tone="text-amber-400" />
          <StatPill value={stats.critical_missing} label="Critical left" tone="text-red-400" />
          <StatPill value={stats.total_items} label="Total" tone="text-white" />
        </div>

        {/* Next actions */}
        {next_actions.length > 0 && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Next actions
            </p>
            <ul className="space-y-1.5">
              {next_actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Category sections */}
      <div className="space-y-3">
        {file.category_meta
          .filter(meta => itemsByCat.has(meta.key))
          .map(meta => {
            const catItems = itemsByCat.get(meta.key)!
            const catStats = categories.find(c => c.key === meta.key)
            return (
              <CategorySection
                key={meta.key}
                label={meta.label}
                items={catItems}
                completed={catStats?.completed ?? 0}
                criticalMissing={catStats?.critical_missing ?? 0}
                savingItemId={savingItemId}
                onStatusChange={onStatusChange}
              />
            )
          })}
      </div>
    </section>
  )
}
