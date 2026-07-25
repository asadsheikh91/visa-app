'use client'

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { StatusPill, toneFromScore } from './StatusPill'

/**
 * ScoreBlock — the paper readiness display.
 *
 * Distilled from the landing hero (components/landing/paper/Hero.tsx): a big
 * IBM Plex Mono numeral over a 20-cell segmented form-box meter, with a
 * bordered verdict stamp. Replaces the dark ScoreRing so scores everywhere
 * read like the landing. Colour comes from the shared tone map (StatusPill):
 * stamp green when ready, budgeted seal-orange when at risk / not ready.
 */
const CELLS = 20

export function ScoreBlock({
  score,
  label,
  size = 'lg',
  animate = true,
  className,
}: {
  score: number
  /** Verdict text (backend band label). Shown in the bordered stamp. */
  label?: string
  size?: 'md' | 'lg'
  animate?: boolean
  className?: string
}) {
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0
  const [shown, setShown] = useState(animate ? 0 : safe)
  const tone = toneFromScore(safe)

  useEffect(() => {
    if (!animate) {
      setShown(safe)
      return
    }
    const start = Date.now()
    const duration = 1000
    let raf = 0
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(safe * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [safe, animate])

  const filled = Math.round((safe / 100) * CELLS)
  const cellFill = tone === 'positive' ? 'border-stamp bg-stamp' : 'border-seal-text bg-seal-text'

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-support">
            Readiness score
          </div>
          <div
            className={clsx(
              'mt-1 font-mono font-bold leading-none tracking-tight text-ink tabular-nums',
              size === 'lg' ? 'text-[56px]' : 'text-[40px]'
            )}
          >
            {shown}
            <span
              className={clsx(
                'font-medium text-support',
                size === 'lg' ? 'text-[22px]' : 'text-[17px]'
              )}
            >
              /100
            </span>
          </div>
        </div>
        {label && (
          <div className="pb-1 text-right">
            <StatusPill tone={tone}>{label}</StatusPill>
          </div>
        )}
      </div>

      {/* Segmented form-box meter — 20 cells, no gauges, no glow. */}
      <div aria-hidden="true" className="mt-4 flex gap-[3px]">
        {Array.from({ length: CELLS }, (_, i) => (
          <span
            key={i}
            className={clsx(
              'h-[9px] flex-1 border',
              i < filled ? cellFill : 'border-hairline bg-paper-deep'
            )}
          />
        ))}
      </div>
    </div>
  )
}
