'use client'

import Link from 'next/link'
import { CheckCircle2, Circle, AlertTriangle, ArrowRight, Trophy, Dot } from 'lucide-react'
import type { Journey, JourneyStep, JourneyStepStatus } from '@/types/visa'

const STATUS_ICON: Record<JourneyStepStatus, { Icon: typeof Circle; cls: string }> = {
  done:    { Icon: CheckCircle2,  cls: 'text-stamp' },
  current: { Icon: Dot,           cls: 'text-stamp' },
  blocked: { Icon: AlertTriangle, cls: 'text-seal-text' },
  todo:    { Icon: Circle,        cls: 'text-support' },
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
    <div className={`flex items-start gap-3 rounded-[3px] border p-3.5 transition-colors ${
      active ? 'border-l-2 border-l-stamp border-y-hairline border-r-hairline bg-white' : 'border-hairline bg-paper-deep'
    } ${clickable ? 'cursor-pointer hover:border-support' : ''}`}>
      <Icon size={18} className={`mt-0.5 flex-shrink-0 ${cls}`} />
      <div className="min-w-0 flex-1">
        <p className={`font-body text-sm font-semibold ${step.status === 'todo' ? 'text-support' : 'text-ink'}`}>
          {step.label}
        </p>
        <p className="mt-0.5 font-body text-xs leading-relaxed text-support">{step.detail}</p>
      </div>
      {clickable && <ArrowRight size={15} className="mt-1 flex-shrink-0 text-stamp" />}
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
      <div className="mb-1 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
          {journey.complete ? <Trophy size={16} className="text-stamp" /> : null}
          Ready to apply
        </h2>
        <span className="font-mono text-2xl font-bold tabular-nums text-stamp">
          {journey.overall_pct}%
        </span>
      </div>

      <div className="mb-4 mt-2 h-2 w-full overflow-hidden rounded-[2px] bg-paper-deep">
        <div
          className="h-full bg-stamp transition-all duration-500"
          style={{ width: `${journey.overall_pct}%` }}
        />
      </div>

      {!journey.complete && (
        <p className="mb-4 font-body text-xs text-support">
          Next: <span className="font-medium text-ink">{journey.next_action_label}</span>
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
