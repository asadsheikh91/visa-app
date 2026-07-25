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
  const color = pct >= 40 ? 'bg-stamp' : 'bg-seal-text'
  return (
    <div className="h-2 w-full overflow-hidden rounded-[2px] bg-paper-deep">
      <div
        className={`h-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
    </div>
  )
}

function StatPill({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="text-center">
      <p className={`font-mono text-xl font-bold leading-none tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-support">{label}</p>
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
    <div className="overflow-hidden rounded-[4px] border border-hairline bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 bg-paper-deep px-4 py-3 transition-colors hover:bg-paper"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {allDone ? (
            <CheckCircle2 size={16} className="flex-shrink-0 text-stamp" />
          ) : (
            <FolderOpen size={16} className="flex-shrink-0 text-support" />
          )}
          <span className="truncate font-body text-sm font-semibold text-ink">{label}</span>
          {criticalMissing > 0 && (
            <span className="flex-shrink-0 rounded-[3px] border border-seal-text/40 bg-seal/[0.06] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-seal-text">
              {criticalMissing} critical
            </span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="font-mono text-xs text-support">
            {completed}/{items.length}
          </span>
          {open ? (
            <ChevronUp size={14} className="text-support" />
          ) : (
            <ChevronDown size={14} className="text-support" />
          )}
        </div>
      </button>

      {open && (
        <div className="space-y-2.5 p-3">
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
      <section className="rounded-[4px] border border-hairline bg-white p-6 text-center shadow-[6px_6px_0_0] shadow-ink/10">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[4px] border border-hairline bg-paper">
          <Lock size={20} className="text-support" />
        </div>
        <h2 className="mb-1 font-serif text-[17px] leading-tight text-ink">Your visa file is locked</h2>
        <p className="mx-auto mb-5 max-w-sm font-body text-xs text-support">
          Run your first readiness check and we&apos;ll generate a personalised document
          file — every item tailored to your country, funding, and background.
        </p>
        <Link href="/tools/student-visa/countries" className="btn-primary text-sm">
          <Sparkles size={14} />
          Start a readiness check
        </Link>
      </section>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center gap-3 rounded-[4px] border border-hairline bg-white p-10 shadow-[6px_6px_0_0] shadow-ink/10">
        <Loader2 size={26} className="animate-spin text-stamp" />
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-support">Building your personalised visa file…</p>
      </section>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !file) {
    return (
      <section className="rounded-[4px] border border-seal-text/40 bg-white p-6 text-center shadow-[6px_6px_0_0] shadow-ink/10">
        <AlertCircle size={24} className="mx-auto mb-3 text-seal-text" />
        <p className="mb-4 font-body text-sm text-ink">
          {error || 'Could not load your visa file.'}
        </p>
        <button onClick={onRetry} className="btn-secondary inline-flex items-center justify-center gap-2 text-sm">
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
      <div className="rounded-[4px] border border-hairline bg-white p-5 shadow-[6px_6px_0_0] shadow-ink/10 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="text-2xl">{countryFlag(file.country)}</span>
            <div className="min-w-0">
              <h2 className="truncate font-serif text-[18px] leading-tight text-ink sm:text-[20px]">
                {countryName(file.country)} Visa File
              </h2>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-support">
                {stats.total_items} documents · {stats.completion_pct}% complete
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <span className="font-mono text-2xl font-bold tabular-nums text-ink">{stats.completion_pct}%</span>
          </div>
        </div>

        <ProgressBar pct={stats.completion_pct} />

        {/* Stat row */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          <StatPill value={stats.completed} label="Ready" tone="text-stamp" />
          <StatPill value={stats.missing_total} label="Outstanding" tone="text-ink" />
          <StatPill value={stats.critical_missing} label="Critical left" tone="text-seal-text" />
          <StatPill value={stats.total_items} label="Total" tone="text-ink" />
        </div>

        {/* Next actions */}
        {next_actions.length > 0 && (
          <div className="mt-5 border-t border-hairline pt-4">
            <p className="mb-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-support">
              Next actions
            </p>
            <ul className="space-y-1.5">
              {next_actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 font-body text-sm text-ink">
                  <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-stamp" />
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
