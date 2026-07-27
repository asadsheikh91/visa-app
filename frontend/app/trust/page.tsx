'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ShieldCheck, Loader2, ExternalLink, Clock, AlertTriangle, CheckCircle2, Bell, BellOff,
} from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { useTrustApi } from '@/lib/useTrustApi'
import { countryName } from '@/lib/dashboardDisplay'
import type { CountryFreshness, ChangelogEntry, FreshnessStatusKind } from '@/types/visa'

const FRESH_UI: Record<FreshnessStatusKind, { text: string; ring: string; label: string }> = {
  fresh: { text: 'text-stamp', ring: 'border-emerald-500/30 bg-emerald-500/5', label: 'Up to date' },
  aging: { text: 'text-warn-text',   ring: 'border-amber-500/30 bg-amber-500/5',   label: 'Review due' },
  stale: { text: 'text-fail-text',     ring: 'border-red-500/30 bg-red-500/5',       label: 'Needs review' },
}

const IMPACT_UI: Record<ChangelogEntry['impact'], string> = {
  high:   'bg-red-500/15 text-fail-text border-fail/30',
  medium: 'bg-amber-500/15 text-warn-text border-amber-500/25',
  low:    'bg-slate-500/15 text-slate-300 border-hairline',
}

function daysAgoLabel(days: number | null): string {
  if (days == null) return 'date unknown'
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 60) return `${days} days ago`
  return `${Math.round(days / 30)} months ago`
}

function FreshnessCard({ f }: { f: CountryFreshness }) {
  const ui = FRESH_UI[f.status]
  return (
    <div className={`rounded-2xl border p-5 ${ui.ring}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-bold text-ink">{countryName(f.country)}</p>
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${ui.text}`}>{ui.label}</span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{f.authority}</p>
      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-slate-500">
        <Clock size={12} />
        Reviewed {daysAgoLabel(f.days_ago)} ({f.last_reviewed})
      </div>
      <a href={f.official_url} target="_blank" rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-[11px] text-stamp hover:text-stamp">
        Official source <ExternalLink size={10} />
      </a>
    </div>
  )
}

function ChangelogTimeline({ entries }: { entries: ChangelogEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">No rule changes recorded yet.</p>
  }
  return (
    <div className="space-y-3">
      {entries.map((e, i) => (
        <div key={i} className="rounded-xl border border-hairline bg-paper-deep p-4">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-ink">{e.date}</span>
            {e.country && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-paper-deep text-slate-300 border border-hairline">
                {countryName(e.country)}
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-paper-deep text-slate-400">{e.area}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-md border ${IMPACT_UI[e.impact]}`}>
              {e.impact} impact
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{e.summary}</p>
          <a href={e.source_url} target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-stamp hover:text-stamp">
            Source <ExternalLink size={10} />
          </a>
        </div>
      ))}
    </div>
  )
}

function TrustContent() {
  const api = useTrustApi()
  const [freshness, setFreshness] = useState<CountryFreshness[]>([])
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([])
  const [optIn, setOptIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingPref, setSavingPref] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [f, c, p] = await Promise.all([
          api.getFreshness(), api.getChangelog(), api.getPreferences(),
        ])
        if (!active) return
        setFreshness(f); setChangelog(c); setOptIn(p.alerts_opt_in)
      } catch {
        if (active) setError('Could not load trust data. Please refresh.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [api])

  const toggleOptIn = useCallback(async () => {
    setSavingPref(true)
    try {
      const next = !optIn
      const res = await api.setPreferences(next)
      setOptIn(res.alerts_opt_in)
    } catch {
      setError('Could not save your alert preference.')
    } finally {
      setSavingPref(false)
    }
  }, [api, optIn])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading trust data…
      </div>
    )
  }

  const anyStale = freshness.some(f => f.status === 'stale')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink flex items-center gap-2">
          <ShieldCheck size={26} className="text-stamp" />
          Trust &amp; rule freshness
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Every rule we check is traceable to an official government source. Here is when each
          destination&apos;s guidance was last reviewed, and what has changed.
        </p>
      </div>

      {error && <p className="text-xs text-fail-text">{error}</p>}

      {anyStale && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <AlertTriangle size={15} className="text-warn-text flex-shrink-0 mt-0.5" />
          <p className="text-xs text-warn-text">
            Some guidance is overdue for review. We flag this openly rather than presenting
            possibly-outdated rules as current — always confirm against the linked official source.
          </p>
        </div>
      )}

      <section>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Source freshness</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {freshness.map(f => <FreshnessCard key={f.country} f={f} />)}
        </div>
      </section>

      <section className="glass rounded-2xl border border-hairline p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink flex items-center gap-2">
            {optIn ? <Bell size={15} className="text-stamp" /> : <BellOff size={15} className="text-slate-500" />}
            Rule-change alerts
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Email me when a rule that affects my destination changes.
          </p>
        </div>
        <button type="button" onClick={toggleOptIn} disabled={savingPref}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            optIn ? 'bg-stamp/10 text-stamp border border-stamp/40'
                  : 'bg-paper-deep text-slate-300 border border-hairline'}`}>
          {savingPref ? <Loader2 size={13} className="animate-spin" /> : optIn ? 'On' : 'Off'}
        </button>
      </section>

      <section>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-stamp" /> Rule changelog
        </p>
        <ChangelogTimeline entries={changelog} />
      </section>
    </div>
  )
}

export default function TrustPage() {
  return (
    <div className="min-h-screen pt-24">
      <AuthGate>
        <TrustContent />
      </AuthGate>
    </div>
  )
}
