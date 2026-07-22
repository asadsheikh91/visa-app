'use client'

import { motion, useReducedMotion } from 'framer-motion'
import clsx from 'clsx'

type StampColor = 'stamp' | 'seal' | 'ink'

const colorClass: Record<StampColor, string> = {
  stamp: 'text-stamp',
  seal: 'text-seal',
  ink: 'text-ink',
}

/**
 * The signature element: a rubber stamp that presses in with a tactile
 * overscale → settle spring, slight rotation, and a brief ink-bleed flash.
 * Fires once when it enters the viewport. Reduced motion: renders static.
 *
 * Render <StampInkFilter /> once on the page for the roughened-ink edge.
 */
export function RubberStamp({
  label,
  sublabel,
  color = 'stamp',
  rotate = -5,
  delay = 0,
  size = 'md',
  className,
}: {
  label: string
  sublabel?: string
  color?: StampColor
  rotate?: number
  delay?: number
  size?: 'sm' | 'md'
  className?: string
}) {
  const reduced = useReducedMotion()

  const face = (
    <span
      className={clsx(
        'block border-current text-center',
        size === 'md' ? 'border-[3px] p-[3px]' : 'border-2 p-[2px]'
      )}
    >
      <span
        className={clsx(
          'block border border-current',
          size === 'md' ? 'px-3.5 py-1.5' : 'px-2.5 py-1'
        )}
      >
        <span
          className={clsx(
            'block whitespace-nowrap font-mono font-bold uppercase',
            size === 'md' ? 'text-[15px] tracking-[0.18em]' : 'text-[11px] tracking-[0.16em]'
          )}
        >
          {label}
        </span>
        {sublabel && (
          <span
            className={clsx(
              'mt-0.5 block whitespace-nowrap font-mono font-medium uppercase',
              size === 'md' ? 'text-[10px] tracking-[0.24em]' : 'text-[9px] tracking-[0.2em]'
            )}
          >
            {sublabel}
          </span>
        )}
      </span>
    </span>
  )

  return (
    <motion.span
      className={clsx('relative inline-block select-none mix-blend-multiply', colorClass[color], className)}
      initial={reduced ? { opacity: 1, rotate } : { opacity: 0, scale: 1.55, rotate: rotate + 7 }}
      whileInView={
        reduced
          ? { opacity: 1, rotate }
          : { opacity: 1, scale: 1, rotate }
      }
      viewport={{ once: true, amount: 0.5 }}
      transition={{
        delay,
        type: 'spring',
        stiffness: 480,
        damping: 26,
        mass: 0.9,
        opacity: { duration: 0.1, delay },
      }}
      style={{ filter: 'url(#pv-ink-bleed)' }}
      aria-label={sublabel ? `${label} ${sublabel}` : label}
      role="img"
    >
      {face}
      {/* Brief ink-bleed: a blurred ghost of the face flashes on press. */}
      {!reduced && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 blur-[3px]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: [0, 0.5, 0] }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ delay: delay + 0.06, duration: 0.45, times: [0, 0.35, 1] }}
        >
          {face}
        </motion.span>
      )}
    </motion.span>
  )
}

/** Roughened rubber-stamp ink edge. Render once per page. */
export function StampInkFilter() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
      <filter id="pv-ink-bleed" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" />
      </filter>
    </svg>
  )
}
