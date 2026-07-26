'use client'

import { Users, ClipboardCheck, CircleDashed, FileText, TrendingDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AdminOverview } from '@/types/admin'
import { DocCard } from '@/components/ui/DocCard'

function Kpi({ label, value, icon: Icon, hint }: { label: string; value: number | string; icon: LucideIcon; hint?: string }) {
  return (
    <DocCard className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-support">{label}</p>
          <p className="mt-2 font-serif text-[30px] leading-none text-ink">{value}</p>
          {hint && <p className="mt-2 font-body text-[12px] text-support">{hint}</p>}
        </div>
        <Icon size={18} className="mt-0.5 flex-shrink-0 text-stamp" aria-hidden="true" />
      </div>
    </DocCard>
  )
}

export function KpiCards({ overview }: { overview: AdminOverview }) {
  const attemptRate = overview.sessions_started > 0
    ? Math.round((overview.sessions_abandoned / overview.sessions_started) * 100)
    : 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Kpi
        label="Registered candidates"
        value={overview.registered_users}
        icon={Users}
        hint={`${overview.onboarded_users} completed onboarding`}
      />
      <Kpi
        label="Attempted readiness"
        value={overview.users_attempted}
        icon={ClipboardCheck}
        hint={`${overview.total_checks} checks completed`}
      />
      <Kpi
        label="Left mid-session"
        value={overview.sessions_abandoned}
        icon={TrendingDown}
        hint={`${attemptRate}% of ${overview.sessions_started} started sessions`}
      />
      <Kpi
        label="Completed sessions"
        value={overview.sessions_completed}
        icon={CircleDashed}
        hint={`${overview.users_completed_check} users with a check`}
      />
      <Kpi
        label="Reports generated"
        value={overview.total_reports}
        icon={FileText}
        hint={`${overview.users_with_report} users with a report`}
      />
      <Kpi
        label="Onboarded candidates"
        value={overview.onboarded_users}
        icon={Users}
        hint={`of ${overview.registered_users} registered`}
      />
    </div>
  )
}

/** Horizontal funnel: registered → onboarded → attempted → completed → report. */
export function FunnelChart({ overview }: { overview: AdminOverview }) {
  const max = Math.max(1, ...overview.funnel.map((s) => s.count))
  return (
    <DocCard padded={false}>
      <div className="border-b border-hairline px-6 py-3.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">Conversion funnel</span>
      </div>
      <div className="space-y-3 px-6 py-5">
        {overview.funnel.map((stage) => {
          const pct = Math.round((stage.count / max) * 100)
          return (
            <div key={stage.stage} className="flex items-center gap-3">
              <span className="w-40 flex-shrink-0 font-body text-[13px] text-support">{stage.stage}</span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-[3px] border border-hairline bg-paper">
                <div className="h-full bg-stamp/20" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-10 flex-shrink-0 text-right font-mono text-[13px] font-bold text-ink">{stage.count}</span>
            </div>
          )
        })}
      </div>
    </DocCard>
  )
}

/** Small breakdown card (plans / outcomes). */
export function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data)
  return (
    <DocCard padded={false}>
      <div className="border-b border-hairline px-6 py-3.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">{title}</span>
      </div>
      <div className="px-6 py-4">
        {entries.length === 0 ? (
          <p className="font-body text-[13px] text-support">No data yet.</p>
        ) : (
          <dl className="space-y-2">
            {entries.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4">
                <dt className="font-body text-[13px] capitalize text-support">{k.replace(/_/g, ' ')}</dt>
                <dd className="font-mono text-[13px] font-bold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </DocCard>
  )
}
