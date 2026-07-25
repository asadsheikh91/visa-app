import clsx from 'clsx'
import type { ReactNode } from 'react'
import { tierFromScore, type ReadinessTier } from '@/types/visa'

/**
 * The single readiness/severity language for the paper app.
 *
 * Colour discipline from the landing system (app/pv-tokens.css): the green
 * stamp is the dominant positive accent; the orange seal is BUDGETED to
 * genuine attention states (blockers, missing, high risk). Everything else is
 * quiet ink/support. Small text uses the AA-safe *-text / stamp / support
 * variants.
 */
export type StatusTone = 'positive' | 'blocker' | 'risk' | 'advisory' | 'neutral'

const toneText: Record<StatusTone, string> = {
  positive: 'text-stamp',
  blocker: 'text-seal-text',
  risk: 'text-seal-text',
  advisory: 'text-support',
  neutral: 'text-support',
}

const toneBorder: Record<StatusTone, string> = {
  positive: 'border-stamp',
  blocker: 'border-seal-text/60',
  risk: 'border-seal-text/50',
  advisory: 'border-hairline',
  neutral: 'border-hairline',
}

/** Bordered mono uppercase document pill (the landing's status-stamp look). */
export function StatusPill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: StatusTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]',
        toneText[tone],
        toneBorder[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

/** Map a 0–100 readiness score to a status tone for pills/meters. */
export function toneFromScore(score: number): StatusTone {
  const tier: ReadinessTier = tierFromScore(score)
  if (tier === 'ready' || tier === 'mostly_ready') return 'positive'
  if (tier === 'needs_work') return 'risk'
  return 'blocker'
}

/** Bare text colour class for a tone (for inline labels without the pill box). */
export function toneTextClass(tone: StatusTone): string {
  return toneText[tone]
}
