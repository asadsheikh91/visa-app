'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { useTimelineApi } from '@/lib/useTimelineApi'
import { useProfileApi } from '@/lib/useProfileApi'
import { ApiError } from '@/lib/api'
import { countryName, countryFlag } from '@/lib/dashboardDisplay'
import type { VisaTimeline, TimelineMilestone } from '@/types/visa'

const COUNTRIES = ['uk', 'usa', 'canada', 'australia'] as const

function isOverdue(m: TimelineMilestone): boolean {
  if (m.status === 'done' || m.status === 'skipped') return false
  const today = new Date().toISOString().slice(0, 10)
  return m.due_date < today
}

function formatDue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Milestone row ─────────────────────────────────────────────────────────────

function MilestoneRow({
  m, onToggle, saving,
}: {
  m: TimelineMilestone
  onToggle: (m: TimelineMilestone) => void
  saving: boolean
}) {
  const done = m.status === 'done'
  const overdue = isOverdue(m)
  return (
    <li className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
      done ? 'border-emerald-500/20 bg-emerald-500/5'
        : overdue ? 'border-red-500/25 bg-red-500/5'
        : 'border-white/10 bg-white/[0.02]'
    }`}>
      <button
        type="button"
        onClick={() => onToggle(m)}
        disabled={saving}
        className="flex-shrink-0 mt-0.5"
        aria-label={done ? 'Mark not done' : 'Mark done'}
      >
        {done
          ? <CheckCircle2 size={18} className="text-emerald-400" />
          : <Circle size={18} className="text-slate-500 hover:text-slate-300" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium ${done ? 'text-slate-500 line-through' : 'text-white'}`}>
            {m.label}
          </p>
          <span className={`text-xs flex-shrink-0 ${overdue ? 'text-red-400 font-semibold' : 'text-slate-500'}`}>
            {overdue && <AlertTriangle size={11} className="inline mr-1 -mt-0.5" />}
            {formatDue(m.due_date)}
          </span>
        </div>
        {m.source && (
          <a
            href={m.source}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300 mt-1"
          >
            Official guidance <ExternalLink size={10} />
          </a>
        )}
      </div>
    </li>
  )
}

// ── Main content ──────────────────────────────────────────────────────────────

function TimelineContent() {
  const api = useTimelineApi()
  const profileApi = useProfileApi()

  const [timeline, setTimeline] = useState<VisaTimeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Setup form
  const [intakeDate, setIntakeDate] = useState('')
  const [country, setCountry] = useState('')
  const [generating, setGenerating] = useState(false)

  // Load existing timeline (or prefill the form from profile on 404).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.getTimeline()
      .then(t => {
        if (cancelled) return
        setTimeline(t)
        setIntakeDate(t.intake_date)
        setCountry(t.country)
      })
      .catch(async e => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 404) {
          // No timeline yet — best-effort prefill from profile.
          try {
            const p = await profileApi.getProfile()
            if (!cancelled && p.primary_country) setCountry(p.primary_country)
          } catch { /* no profile — leave blank */ }
        } else {
          setError(e instanceof ApiError ? e.message : 'Failed to load your timeline.')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [api, profileApi])

  const onGenerate = useCallback(async () => {
    if (!intakeDate || !country) return
    setGenerating(true)
    setError(null)
    try {
      const t = await api.generateTimeline(intakeDate, country)
      setTimeline(t)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to build your timeline.')
    } finally {
      setGenerating(false)
    }
  }, [api, intakeDate, country])

  const onToggle = useCallback(async (m: TimelineMilestone) => {
    if (!timeline) return
    const next = m.status === 'done' ? 'upcoming' : 'done'
    setSavingId(m.id)
    try {
      const updated = await api.updateMilestone(m.id, { status: next })
      setTimeline(updated)
    } catch {
      /* keep previous state on failure */
    } finally {
      setSavingId(null)
    }
  }, [api, timeline])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 size={28} className="text-brand-400 animate-spin" />
        <p className="text-slate-500 text-sm">Loading your timeline…</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
          <CalendarClock size={26} className="text-brand-400" />
          Deadline planner
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Set your course intake and we&apos;ll work backwards to every key deadline.
        </p>
      </div>

      {/* Setup */}
      <section className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-slate-300 mb-1.5">Course intake date</p>
            <input
              type="date"
              value={intakeDate}
              onChange={e => setIntakeDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300 mb-1.5">Destination</p>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 appearance-none"
            >
              <option value="" className="bg-surface-900">Select…</option>
              {COUNTRIES.map(c => (
                <option key={c} value={c} className="bg-surface-900">
                  {countryFlag(c)} {countryName(c)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-xs text-red-300 mt-3">{error}</p>}
        <button
          type="button"
          onClick={onGenerate}
          disabled={!intakeDate || !country || generating}
          className="btn-primary w-full justify-center text-sm mt-4"
        >
          {generating
            ? <><Loader2 size={14} className="animate-spin" /> Building…</>
            : timeline ? 'Rebuild timeline' : 'Build my timeline'}
        </button>
      </section>

      {/* Timeline */}
      {timeline && (
        <section className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Your milestones
            </h2>
            <span className="text-xs text-slate-500">
              {timeline.stats.done}/{timeline.stats.total} done · {timeline.stats.completion_pct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 mb-4 overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${timeline.stats.completion_pct}%` }}
            />
          </div>
          <ul className="space-y-2">
            {timeline.milestones.map(m => (
              <MilestoneRow key={m.id} m={m} onToggle={onToggle} saving={savingId === m.id} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default function TimelinePage() {
  return (
    <div className="min-h-screen pt-24">
      <AuthGate>
        <TimelineContent />
      </AuthGate>
    </div>
  )
}
