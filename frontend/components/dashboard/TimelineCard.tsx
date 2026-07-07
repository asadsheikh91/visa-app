'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, ArrowRight } from 'lucide-react'
import { useTimelineApi } from '@/lib/useTimelineApi'
import { ApiError } from '@/lib/api'
import type { VisaTimeline } from '@/types/visa'

function formatDue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Compact dashboard summary of the deadline planner (Module C). */
export function TimelineCard() {
  const api = useTimelineApi()
  const [timeline, setTimeline] = useState<VisaTimeline | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.getTimeline()
      .then(t => { if (!cancelled) setTimeline(t) })
      .catch((e) => { if (!cancelled && !(e instanceof ApiError && e.status === 404)) { /* ignore */ } })
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [api])

  if (!loaded) {
    return <section className="glass rounded-2xl border border-white/10 p-6 h-24 animate-pulse" />
  }

  const header = (
    <div className="flex items-center gap-2 mb-3">
      <CalendarClock size={16} className="text-slate-400" />
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        Deadline planner
      </h2>
    </div>
  )

  // No timeline yet → CTA.
  if (!timeline) {
    return (
      <section className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
        {header}
        <p className="text-slate-500 text-xs mb-4">
          Set your course intake and get a backward plan of every key deadline.
        </p>
        <Link href="/timeline" className="btn-primary text-xs py-2 px-3.5">
          Plan my deadlines <ArrowRight size={13} />
        </Link>
      </section>
    )
  }

  const next = timeline.next_due
  return (
    <section className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
      {header}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {next ? (
            <>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide">Next up</p>
              <p className="text-sm font-semibold text-white truncate">{next.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{formatDue(next.due_date)}</p>
            </>
          ) : (
            <p className="text-sm text-emerald-300/90">All milestones complete 🎉</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-white">{timeline.stats.completion_pct}%</p>
          <p className="text-[11px] text-slate-500">{timeline.stats.done}/{timeline.stats.total} done</p>
        </div>
      </div>
      <Link
        href="/timeline"
        className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-4"
      >
        Open planner <ArrowRight size={12} />
      </Link>
    </section>
  )
}
