'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { animate, motion, useReducedMotion } from 'framer-motion'
import { RubberStamp, StampInkFilter } from './RubberStamp'
import { StampMark } from './StampMark'
import { Section } from './Section'

const CHECKER_HREF = '/tools/student-visa/countries'
const SCORE = 82

// TODO(content): confirm the exact figures before launch — these are the
// brief's example values, not verified numbers. VISA_FEE names the money the
// applicant stands to lose (UK Student visa application fee); FULL_REPORT_PRICE
// is the paid tier shown above the fold so pricing is never hidden behind
// signup. Do not ship without confirming both.
const VISA_FEE = '£490'
const FULL_REPORT_PRICE = 'PKR 1,500'

const trust = ['Free readiness score', 'Answer in 2 minutes', 'Rules from official sources']

const fileRows: [string, string][] = [
  ['Applicant', 'A. R. Khan'],
  ['Route', 'Pakistan → United Kingdom'],
  ['Program', 'MSc Computer Science'],
  ['Intake', 'September 2026'],
]

// The card describes what the tool actually does — it scores self-reported
// answers against published rules. It does NOT verify documents, so no row may
// read "verified". States: meets = clears the published threshold; onfile =
// the applicant reports holding it; missing = absent, needs action.
const checkRows: { doc: string; state: 'meets' | 'onfile' | 'missing'; label: string }[] = [
  { doc: 'Financial evidence', state: 'meets', label: 'Meets threshold' },
  { doc: 'CAS + offer letter', state: 'onfile', label: 'On file' },
  { doc: 'TB certificate', state: 'missing', label: 'Missing' },
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
      // overflow-hidden is the hard guarantee that the watermark can never
      // produce horizontal scroll at any viewport width.
      className="relative overflow-hidden"
      // Positions the watermark against the CONTAINER edge, not the viewport.
      innerClassName="relative"
    >
      <StampInkFilter />

      {/* Watermark seal — documents carry watermarks; ours is the mark itself.
          Sits inside the container, vertically centred, inset from the
          container's right edge, and behind the card (z-0 vs the grid's z-10). */}
      {/* (StampMark sets aria-hidden on its own <svg>.) */}
      {/* 420px overflows the container below ~md, so it steps down to stay
          fully inside the hero at every width. */}
      <StampMark className="pointer-events-none absolute right-12 top-1/2 z-0 h-[240px] w-[240px] -translate-y-1/2 text-ink opacity-[0.035] sm:h-[340px] sm:w-[340px] md:h-[420px] md:w-[420px]" />

      <div className="relative z-10 grid grid-cols-1 items-start gap-14 lg:grid-cols-12 lg:gap-10">
        {/* ── Left: copy ── */}
        <div className="lg:col-span-7 lg:pr-6">
          <motion.p
            {...rise(reduced, 0)}
            className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-support"
          >
            Student visa readiness&ensp;·&ensp;PK → UK · AUS · CAN · USA
          </motion.p>

          {/* One declarative line. No em-dash, no italic second line — those
              read as generated. Sizes are conservative because the headline now
              wraps 2–3 lines naturally rather than to a designed two-line break;
              text-balance evens the ragged edge. NOTE(CLS): the serif fallback
              metrics in pv-tokens.css were tuned to the previous headline's wrap
              counts and may need re-measuring for this longer string. */}
          <h1
            id="hero-heading"
            className="mt-6 text-balance font-serif text-[32px] font-medium leading-[1.08] tracking-[-0.015em] text-ink sm:text-[44px] md:text-[52px] lg:text-[42px] xl:text-[52px] 2xl:text-[56px]"
          >
            <motion.span {...rise(reduced, 0.08)} className="block">
              Don&rsquo;t lose {VISA_FEE} finding out your file was incomplete.
            </motion.span>
          </h1>

          <motion.p
            {...rise(reduced, 0.26)}
            className="measure mt-6 font-body text-[17px] leading-relaxed text-support"
          >
            ParchiVisa checks every document against the official rules, scores your readiness, and
            tells you exactly what to fix before you apply.
          </motion.p>

          <motion.div {...rise(reduced, 0.34)} className="mt-9 flex flex-wrap items-center gap-6">
            <Link
              href={CHECKER_HREF}
              className="rounded-[3px] bg-stamp px-6 py-3.5 font-body text-[15px] font-semibold text-paper transition-colors hover:bg-stamp-deep"
            >
              Check my readiness — free
            </Link>
            {/* TODO(content): point at the real, ungated sample report once the
                sample asset exists; brief requires it not be hidden behind
                signup. Anchored to how-it-works as an interim, honest target. */}
            <Link
              href="/#how-it-works"
              className="font-body text-[15px] font-medium text-ink underline decoration-hairline underline-offset-[6px] transition-colors hover:decoration-stamp"
            >
              See a sample report
            </Link>
          </motion.div>

          {/* Pricing is visible in the first scroll — hiding it behind signup
              reads as bait-and-switch in this market. */}
          <motion.p
            {...rise(reduced, 0.38)}
            className="mt-6 font-mono text-[12px] uppercase tracking-[0.1em] text-support"
          >
            Free readiness score. Full report {FULL_REPORT_PRICE}.
          </motion.p>

          {/* Persistent disclaimer, repeated directly under the CTA (also in the
              footer on every page). Keeps every claim inside what the tool does. */}
          <motion.p
            {...rise(reduced, 0.44)}
            className="measure mt-3 font-body text-[12px] leading-relaxed text-support"
          >
            ParchiVisa is an independent tool. Not affiliated with, endorsed by, or acting on behalf
            of any government, embassy, or high commission. This is not immigration advice.
          </motion.p>

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
          className="relative overflow-visible lg:col-span-5 lg:mt-2"
          initial={reduced ? undefined : { opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 220, damping: 30 }}
        >
          <DocumentCard reduced={reduced} />

          {/* Stamp pressed ACROSS the card's top-right corner.
              Outer box = placement only: anchored to the corner, then shifted
              out by ~37% of its own size on both axes so it straddles the edge.
              The x-shift steps down on narrower desktops, where the gap between
              the container edge and the viewport is too small to clear the
              section's overflow-hidden. Inner box = rotation + 14px of padding,
              so the rotated bounding box never crops the ink. */}
          <div className="absolute right-0 top-0 z-20 -translate-y-[37%] translate-x-[16%] overflow-visible xl:translate-x-[26%] 2xl:translate-x-[37%]">
            <div className="-rotate-[8deg] overflow-visible p-[14px]">
              <RubberStamp label="Assessed" sublabel="PV · 23 Jul 2026" rotate={0} delay={1.15} />
            </div>
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
        {/* The header keeps the whole top-left run to itself — the form number
            moved to the bottom meta row so the corner stamp lands on paper. */}
        <div className="border-b border-hairline pb-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink">
            Readiness assessment
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
          {checkRows.map(({ doc, state, label }) => (
            <li key={doc} className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
                {doc}
              </span>
              <span
                className={`font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] ${
                  state === 'meets'
                    ? 'text-stamp'
                    : state === 'missing'
                      ? // seal-orange budget: a genuine attention state.
                        // seal-text (not seal) because 10.5px needs AA 4.5:1.
                        'text-seal-text'
                      : 'text-support'
                }`}
              >
                {label}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-end justify-end gap-4 border-t border-hairline pt-4">
          <span className="flex items-baseline gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-support">
            <span>ParchiVisa Readiness Report</span>
            <span aria-hidden="true" className="text-hairline">
              ·
            </span>
            PV-2026-0193
          </span>
        </div>
      </div>
    </div>
  )
}
