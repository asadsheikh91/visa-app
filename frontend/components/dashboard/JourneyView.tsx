'use client'

import Link from 'next/link'
import { CheckCircle2, Circle, AlertTriangle, ArrowRight, Trophy, Dot } from 'lucide-react'
import type { Journey, JourneyStep, JourneyStepStatus } from '@/types/visa'

const STATUS_ICON: Record<JourneyStepStatus, { Icon: typeof Circle; cls: string }> = {
  done:    { Icon: CheckCircle2,  cls: 'text-emerald-400' },
  current: { Icon: Dot,           cls: 'text-brand-400' },
  blocked: { Icon: AlertTriangle, cls: 'text-red-400' },
  todo:    { Icon: Circle,        cls: 'text-slate-600' },
}

/** Parse "/dashboard?section=action_plan" → "action_plan", else null. */
function sectionFromHref(href: string | null): string | null {
  if (!href) return null
  const m = href.match(/^\/dashboard\?section=(.+)$/)
  return m ? m[1] : null
}

function StepRow({ step, onNavigateSection, interactive }: {
  step: JourneyStep
  onNavigateSection?: (section: string) => void
  interactive: boolean
}) {
  const { Icon, cls } = STATUS_ICON[step.status]
  const active = step.status === 'current' || step.status === 'blocked'
  const section = sectionFromHref(step.href)
  const clickable = interactive && active && (!!step.href || !!section)

  const body = (
    <div className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors ${
      active ? 'border-brand-500/30 bg-brand-500/[0.04]' : 'border-white/8 bg-white/[0.02]'
    } ${clickable ? 'hover:border-brand-500/50 cursor-pointer' : ''}`}>
      <Icon size={18} className={`flex-shrink-0 mt-0.5 ${cls}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${step.status === 'todo' ? 'text-slate-400' : 'text-white'}`}>
          {step.label}
        </p>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{step.detail}</p>
      </div>
      {clickable && <ArrowRight size={15} className="text-brand-400 flex-shrink-0 mt-1" />}
    </div>
  )

  if (clickable && section && onNavigateSection) {
    return <button type="button" onClick={() => onNavigateSection(section)} className="block w-full text-left">{body}</button>
  }
  if (clickable && step.href && !section) {
    return <Link href={step.href} className="block">{body}</Link>
  }
  return body
}

/**
 * Presentational journey spine — renders a Journey object. Reused by the
 * dashboard (interactive) and the consultant client view (read-only).
 */
export function JourneyView({ journey, onNavigateSection, interactive = true }: {
  journey: Journey
  onNavigateSection?: (section: string) => void
  interactive?: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-1">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          {journey.complete ? <Trophy size={16} className="text-emerald-400" /> : null}
          Ready to apply
        </h2>
        <span className={`text-2xl font-extrabold ${journey.complete ? 'text-emerald-400' : 'text-brand-400'}`}>
          {journey.overall_pct}%
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-white/8 overflow-hidden mt-2 mb-4">
        <div
          className={`h-full rounded-full transition-all duration-500 ${journey.complete ? 'bg-emerald-400' : 'bg-gradient-to-r from-brand-500 to-brand-400'}`}
          style={{ width: `${journey.overall_pct}%` }}
        />
      </div>

      {!journey.complete && (
        <p className="text-xs text-slate-400 mb-4">
          Next: <span className="text-white font-medium">{journey.next_action_label}</span>
        </p>
      )}

      <div className="space-y-2">
        {journey.steps.map(step => (
          <StepRow key={step.id} step={step} onNavigateSection={onNavigateSection} interactive={interactive} />
        ))}
      </div>
    </div>
  )
}
