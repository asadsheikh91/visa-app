'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { animate, motion, useReducedMotion } from 'framer-motion'
import { RubberStamp, StampInkFilter } from './RubberStamp'
import { StampMark } from './StampMark'
import { Section } from './Section'

const CHECKER_HREF = '/tools/student-visa/countries'
const SCORE = 82

const trust = ['Free readiness score', 'Answer in 2 minutes', 'Rules from official sources']

const fileRows: [string, string][] = [
  ['Applicant', 'A. R. Khan'],
  ['Route', 'Pakistan → United Kingdom'],
  ['Program', 'MSc Computer Science'],
  ['Intake', 'September 2026'],
]

const checkRows: { doc: string; state: 'verified' | 'action' }[] = [
  { doc: 'Financial evidence', state: 'verified' },
  { doc: 'CAS + offer letter', state: 'verified' },
  { doc: 'TB certificate', state: 'action' },
]

const rise = (reduced: boolean, delay: number) => ({
  initial: reduced ? undefined : { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 260, damping: 30 },
})

export function Hero() {
  const reduced = useReducedMotion() ?? false

  return (
    <Section aria-labelledby="hero-heading" tone="paper" className="relative overflow-hidden">
      <StampInkFilter />
      {/* Watermark seal — documents carry watermarks; ours is the mark itself. */}
      <StampMark className="pointer-events-none absolute -right-24 -top-24 h-[460px] w-[460px] text-ink opacity-[0.035]" />

      <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-12 lg:gap-10">
        {/* ── Left: copy ── */}
        <div className="lg:col-span-7 lg:pr-6">
          <motion.p
            {...rise(reduced, 0)}
            className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-support"
          >
            Student visa readiness&ensp;·&ensp;PK → UK · AUS · CAN · USA
          </motion.p>

          <h1
            id="hero-heading"
            className="mt-6 font-serif text-[44px] font-medium leading-[1.04] tracking-[-0.015em] text-ink sm:text-[58px] lg:text-[64px]"
          >
            <motion.span {...rise(reduced, 0.08)} className="block">
              Know you&rsquo;re ready&thinsp;—
            </motion.span>
            <motion.span {...rise(reduced, 0.16)} className="block text-balance italic">
              before the embassy does.
            </motion.span>
          </h1>

          <motion.p
            {...rise(reduced, 0.26)}
            className="measure mt-6 font-body text-[17px] leading-relaxed text-support"
          >
            ParchiVisa reads your file the way a visa officer will — it checks every document
            against the official rules, scores your readiness, and tells you exactly what to fix
            before you pay the application fee.
          </motion.p>

          <motion.div {...rise(reduced, 0.34)} className="mt-9 flex flex-wrap items-center gap-6">
            <Link
              href={CHECKER_HREF}
              className="rounded-[3px] bg-stamp px-6 py-3.5 font-body text-[15px] font-semibold text-paper transition-colors hover:bg-stamp-deep"
            >
              Check my readiness — free
            </Link>
            <Link
              href="/#how-it-works"
              className="font-body text-[15px] font-medium text-ink underline decoration-hairline underline-offset-[6px] transition-colors hover:decoration-stamp"
            >
              See how it works
            </Link>
          </motion.div>

          <motion.ul
            {...rise(reduced, 0.42)}
            className="mt-12 flex max-w-[640px] flex-wrap items-center gap-y-3 border-t border-hairline pt-5"
          >
            {trust.map((t, i) => (
              <li
                key={t}
                className={`whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.12em] text-support ${
                  i > 0 ? 'border-l border-hairline pl-3.5' : ''
                } ${i < trust.length - 1 ? 'pr-3.5' : ''}`}
              >
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* ── Right: the official document card ── */}
        <motion.div
          className="relative lg:col-span-5 lg:mt-2"
          initial={reduced ? undefined : { opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 220, damping: 30 }}
        >
          <DocumentCard reduced={reduced} />
          <div className="absolute -right-3 -top-9 z-10 sm:-right-5">
            <RubberStamp label="Ready ✓" sublabel="PV · 23 Jul 2026" rotate={-8} delay={1.15} />
          </div>
        </motion.div>
      </div>
    </Section>
  )
}

/* ── The readiness assessment slip ─────────────────────────────────────── */

function DocumentCard({ reduced }: { reduced: boolean }) {
  const [score, setScore] = useState(reduced ? SCORE : 0)

  useEffect(() => {
    if (reduced) return
    const controls = animate(0, SCORE, {
      delay: 0.55,
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setScore(Math.round(v)),
    })
    return () => controls.stop()
  }, [reduced])

  const filled = Math.round((SCORE / 100) * 20)

  return (
    <div className="relative border border-ink bg-white shadow-[6px_6px_0_0] shadow-ink/10">
      {/* Perforated top edge — a parchi is a slip you tear off. */}
      <div
        aria-hidden="true"
        className="absolute -top-[5px] left-0 right-0 h-[10px]"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--pv-paper) 3px, transparent 3.5px)',
          backgroundSize: '16px 10px',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'center',
        }}
      />

      <div className="px-6 pb-6 pt-7 sm:px-7">
        <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink">
            Readiness assessment
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-support">
            Form PV-01
          </span>
        </div>

        <dl className="mt-4 space-y-2">
          {fileRows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-support">
                {label}
              </dt>
              <dd className="text-right font-mono text-[12px] font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 border-t border-hairline pt-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-support">
                Readiness score
              </div>
              <div className="mt-1 font-mono text-[56px] font-bold leading-none tracking-tight text-ink tabular-nums">
                {score}
                <span className="text-[22px] font-medium text-support">/100</span>
              </div>
            </div>
            <div className="pb-1 text-right">
              <span className="inline-block border border-stamp px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-stamp">
                Strong — minor gaps
              </span>
            </div>
          </div>

          {/* Segmented form-box meter: 20 cells, no gauges, no glow. */}
          <div aria-hidden="true" className="mt-4 flex gap-[3px]">
            {Array.from({ length: 20 }, (_, i) => (
              <span
                key={i}
                className={`h-[9px] flex-1 border ${
                  i < filled ? 'border-stamp bg-stamp' : 'border-hairline bg-paper-deep'
                }`}
              />
            ))}
          </div>
        </div>

        <ul className="mt-5 space-y-2 border-t border-hairline pt-4">
          {checkRows.map(({ doc, state }) => (
            <li key={doc} className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
                {doc}
              </span>
              {state === 'verified' ? (
                <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-stamp">
                  Verified ✓
                </span>
              ) : (
                /* seal-orange budget use 1 of 3: a genuine action-required state */
                <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-seal">
                  Action required
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-hairline pt-4">
          <Barcode />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-support">
            PV-2026-0193
          </span>
        </div>
      </div>
    </div>
  )
}

const BAR_WIDTHS = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 4, 1, 2, 1, 1, 3, 2]

function Barcode() {
  let x = 0
  return (
    <svg aria-hidden="true" className="h-7 w-[132px] text-ink opacity-80" viewBox="0 0 100 28">
      {BAR_WIDTHS.map((w, i) => {
        const rect = <rect key={i} x={x} y={0} width={w} height={28} fill="currentColor" />
        x += w + 1.4
        return rect
      })}
    </svg>
  )
}
