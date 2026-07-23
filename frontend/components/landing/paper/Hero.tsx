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
    <Section
      aria-labelledby="hero-heading"
      tone="paper"
      className="relative overflow-hidden"
      // Bottom padding is cut against the standard band so the paper-deep
      // seam of the next section carries the transition, not blank paper.
      innerClassName="pb-[calc(var(--band-y)*0.45)]"
    >
      <StampInkFilter />
      {/* Watermark seal — documents carry watermarks; ours is the mark itself. */}
      <StampMark className="pointer-events-none absolute -right-24 -top-24 h-[460px] w-[460px] text-ink opacity-[0.035]" />

      {/* 12-col: copy 1-5, card 7-12 (col 6 is the gutter between them).
          items-start baseline-aligns the eyebrow with the card's top edge. */}
      <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-12 lg:gap-x-8">
        {/* ── Left: copy, cols 1-5 ── */}
        <div className="lg:col-span-5">
          <motion.p {...rise(reduced, 0)} className="type-mono-micro text-support">
            Student visa readiness&ensp;·&ensp;PK → UK · AUS · CAN · USA
          </motion.p>

          {/* Set as one balanced block, not forced line-breaks: at cols 1-5
              the display size needs the typesetter's freedom to break well. */}
          <h1 id="hero-heading" className="type-display mt-7 text-balance text-ink">
            <motion.span {...rise(reduced, 0.08)}>Know you&rsquo;re ready&thinsp;— </motion.span>
            <motion.span {...rise(reduced, 0.16)} className="italic">
              before the embassy does.
            </motion.span>
          </h1>

          {/* The promise, sharpened — the tier that was missing. */}
          <motion.p {...rise(reduced, 0.24)} className="type-lead measure mt-7 text-ink">
            Find the mistakes that get files refused while you can still fix them.
          </motion.p>

          <motion.p {...rise(reduced, 0.3)} className="type-body-lg measure mt-5 text-support">
            ParchiVisa reads your file the way a visa officer will — it checks every document
            against the official rules, scores your readiness, and tells you exactly what to fix
            before you pay the application fee.
          </motion.p>

          <motion.div {...rise(reduced, 0.38)} className="mt-9 flex flex-wrap items-center gap-7">
            <Link
              href={CHECKER_HREF}
              className="type-body-lg rounded-[3px] bg-stamp px-8 py-[1.125rem] font-semibold leading-none text-paper transition-colors hover:bg-stamp-deep"
            >
              Check my readiness
            </Link>
            <Link
              href="/#how-it-works"
              className="type-body-lg font-medium text-ink underline decoration-hairline underline-offset-[6px] transition-colors hover:decoration-stamp"
            >
              See how it works
            </Link>
          </motion.div>

          {/* No dividers: the strip wraps to two lines at this column width,
              and any separator glyph or border strands itself on the wrap.
              Spacing alone reads as form print. */}
          <motion.ul
            {...rise(reduced, 0.46)}
            className="type-mono-micro mt-11 flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-hairline pt-5 text-support"
          >
            {trust.map((t) => (
              <li key={t} className="whitespace-nowrap">
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* ── Right: the official document card, cols 7-12 ── */}
        <motion.div
          className="relative lg:col-span-6 lg:col-start-7"
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

      {/* Type/spacing here runs ~25% heavier than the page's form print — the
          card is the hero's counterweight, not a footnote. */}
      <div className="px-7 pb-8 pt-9 sm:px-9">
        <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-4">
          <span className="font-mono text-[13px] font-bold uppercase tracking-[0.2em] text-ink">
            Readiness assessment
          </span>
          <span className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-support">
            Form PV-01
          </span>
        </div>

        <dl className="mt-5 space-y-2.5">
          {fileRows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-[12px] uppercase tracking-[0.14em] text-support">
                {label}
              </dt>
              <dd className="text-right font-mono text-[14px] font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 border-t border-hairline pt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-support">
                Readiness score
              </div>
              <div className="mt-1.5 font-mono text-[70px] font-bold leading-none tracking-tight text-ink tabular-nums">
                {score}
                <span className="text-[27px] font-medium text-support">/100</span>
              </div>
            </div>
            <div className="pb-1.5 text-right">
              <span className="inline-block border border-stamp px-2.5 py-1.5 font-mono text-[11.5px] font-bold uppercase tracking-[0.14em] text-stamp">
                Strong — minor gaps
              </span>
            </div>
          </div>

          {/* Segmented form-box meter: 20 cells, no gauges, no glow. */}
          <div aria-hidden="true" className="mt-5 flex gap-[3px]">
            {Array.from({ length: 20 }, (_, i) => (
              <span
                key={i}
                className={`h-[11px] flex-1 border ${
                  i < filled ? 'border-stamp bg-stamp' : 'border-hairline bg-paper-deep'
                }`}
              />
            ))}
          </div>
        </div>

        <ul className="mt-6 space-y-2.5 border-t border-hairline pt-5">
          {checkRows.map(({ doc, state }) => (
            <li key={doc} className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-[13px] uppercase tracking-[0.12em] text-ink">
                {doc}
              </span>
              {state === 'verified' ? (
                <span className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-stamp">
                  Verified ✓
                </span>
              ) : (
                /* seal-orange budget use 1 of 3: a genuine action-required state */
                <span className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-seal">
                  Action required
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-end justify-between gap-4 border-t border-hairline pt-5">
          <Barcode />
          <span className="font-mono text-[11.5px] uppercase tracking-[0.18em] text-support">
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
    <svg aria-hidden="true" className="h-9 w-[165px] text-ink opacity-80" viewBox="0 0 100 28">
      {BAR_WIDTHS.map((w, i) => {
        const rect = <rect key={i} x={x} y={0} width={w} height={28} fill="currentColor" />
        x += w + 1.4
        return rect
      })}
    </svg>
  )
}
