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
    return <section className="h-24 animate-pulse rounded-[4px] border border-hairline bg-white" />
  }

  const header = (
    <div className="mb-3 flex items-center gap-2">
      <CalendarClock size={16} className="text-stamp" />
      <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
        Deadline planner
      </h2>
    </div>
  )

  // No timeline yet → CTA.
  if (!timeline) {
    return (
      <section className="rounded-[4px] border border-hairline bg-white p-5 shadow-[6px_6px_0_0] shadow-ink/10 sm:p-6">
        {header}
        <p className="mb-4 font-body text-xs text-support">
          Set your course intake and get a backward plan of every key deadline.
        </p>
        <Link href="/timeline" className="btn-primary px-3.5 py-2 text-xs">
          Plan my deadlines <ArrowRight size={13} />
        </Link>
      </section>
    )
  }

  const next = timeline.next_due
  return (
    <section className="rounded-[4px] border border-hairline bg-white p-5 shadow-[6px_6px_0_0] shadow-ink/10 sm:p-6">
      {header}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {next ? (
            <>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-support">Next up</p>
              <p className="truncate font-body text-sm font-semibold text-ink">{next.label}</p>
              <p className="mt-0.5 font-mono text-xs text-support">{formatDue(next.due_date)}</p>
            </>
          ) : (
            <p className="font-body text-sm text-stamp">All milestones complete 🎉</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="font-mono text-lg font-bold tabular-nums text-ink">{timeline.stats.completion_pct}%</p>
          <p className="font-mono text-[10.5px] text-support">{timeline.stats.done}/{timeline.stats.total} done</p>
        </div>
      </div>
      <Link
        href="/timeline"
        className="mt-4 inline-flex items-center gap-1 font-body text-xs text-stamp hover:text-stamp-deep"
      >
        Open planner <ArrowRight size={12} />
      </Link>
    </section>
  )
}
