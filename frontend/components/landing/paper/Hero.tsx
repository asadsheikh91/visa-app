'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { RubberStamp, StampInkFilter } from './RubberStamp'
import { StampMark } from './StampMark'
import { Section } from './Section'
import { AssessmentStarter } from './AssessmentStarter'
import { SAMPLE_REPORT, type ReportLineStatus } from '@/content/sample-report'
import { RULES_UPDATED_LABEL } from '@/content/site-config'

const CHECKER_HREF = '/tools/student-visa/countries'
const FULL_REPORT_PRICE = 'PKR 1,500'

const trust = ['Sourced from GOV.UK · IRCC · Home Affairs', RULES_UPDATED_LABEL]

// Single shared easing token (mirrors --ease-doc in pv-tokens.css — kept as a
// literal here because framer's JS transition option can't read a CSS var).
const EASE_DOC = [0.16, 1, 0.3, 1] as const

// Report-card colour keyframes need literal values, not var() refs (framer
// can't interpolate a CSS custom property as a colour) — mirrors pv-tokens.css.
const INK_HEX = '#14213D' // --pv-ink
const PASS_HEX = '#1F6B4A' // --pv-stamp
const WARN_HEX = '#92400E' // --pv-warn-text
const FAIL_TEXT_HEX = '#B3261E' // --pv-fail-text
const FAIL_HEX = '#DC2626' // --pv-fail
const statusHex: Record<ReportLineStatus, string> = { pass: PASS_HEX, warn: WARN_HEX, fail: FAIL_TEXT_HEX }

// Segmented bar fill colour by score band. The badge pill stays red regardless
// (it's this sample's overall verdict) — an all-red bar at 61/100 read as
// "everything is wrong", which a 61 isn't.
function barBandClass(score: number) {
  if (score < 50) return 'border-fail bg-fail'
  if (score < 75) return 'border-warn bg-warn'
  return 'border-stamp bg-stamp'
}

// ── Page-load sequence (seconds, from first paint) — see brief Part B table.
const T = {
  eyebrow: 0.15,
  headlineLine1: 0.25,
  headlineLine2: 0.33,
  subhead: 0.45,
  ctaRow: 0.6,
  microCopy: 0.7,
  disclaimer: 0.76,
  trustBar: 0.82,
  card: 0.35,
  stamp: 1.1,
  countStart: 1.3,
  countDuration: 0.9,
  linesStart: 1.5,
  lineStagger: 0.07,
  starter: 1.9,
}
const countEnd = T.countStart + T.countDuration

function fadeRise(reduced: boolean, delay: number, duration: number, distance = 10) {
  return {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: distance },
    animate: { opacity: 1, y: 0 },
    transition: reduced ? { duration: 0.2, delay } : { duration, delay, ease: EASE_DOC },
  }
}

function fadeOnly(reduced: boolean, delay: number, duration = 0.4) {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: reduced ? 0.2 : duration, delay },
  }
}

/** One "printed" headline line — text sits in the DOM at first paint, hidden
 *  by transform (never display:none), masked by the overflow-hidden wrapper. */
function MaskLine({
  reduced,
  delay,
  children,
}: {
  reduced: boolean
  delay: number
  children: ReactNode
}) {
  return (
    <span className="block overflow-hidden">
      <motion.span
        className="block"
        initial={reduced ? { opacity: 0 } : { y: '100%' }}
        animate={reduced ? { opacity: 1 } : { y: 0 }}
        transition={reduced ? { duration: 0.2, delay } : { duration: 0.6, delay, ease: EASE_DOC }}
      >
        {children}
      </motion.span>
    </span>
  )
}

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
      // Section's shared `py-band` (~72-120px) sets top AND bottom padding;
      // pt-* here overrides just the top (Tailwind's padding plugin always
      // emits pt-* after py-*, so same-specificity pt-* wins) — bottom is
      // untouched, so this only shrinks the hero, never pads it out further.
      innerClassName="relative pt-8 md:pt-12 lg:pt-20"
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
          {/* Two explicit lines, not a natural wrap — the previous single-line
              copy wrapped onto a leading "· UK · AUS..." at exactly this
              column width, an orphaned separator. Line 2 sits at reduced
              opacity so the two-line break reads as intentional hierarchy. */}
          <motion.p
            {...fadeRise(reduced, T.eyebrow, 0.45, 8)}
            className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-support"
          >
            <span className="block">Student visa readiness · 2026&ndash;27 intakes</span>
            <span className="mt-1 block text-support/70">UK · Australia · Canada · USA</span>
          </motion.p>

          {/* Two "printed" lines, each independently mask-revealed — the
              metaphor is text being printed onto the page. text-balance evens
              the ragged edge inside each line if it wraps further on its own. */}
          <h1
            id="hero-heading"
            className="mt-6 text-balance font-serif text-[32px] font-medium leading-[1.08] tracking-[-0.015em] text-ink sm:text-[44px] md:text-[52px] lg:text-[42px] xl:text-[52px] 2xl:text-[56px]"
          >
            <MaskLine reduced={reduced} delay={T.headlineLine1}>
              Find out what&rsquo;s wrong with your file now,
            </MaskLine>
            <MaskLine reduced={reduced} delay={T.headlineLine2}>
              not in the refusal letter.
            </MaskLine>
          </h1>

          <motion.div
            {...fadeRise(reduced, T.subhead, 0.5)}
            className="mt-4 max-w-[58ch] font-body text-[17px] leading-relaxed text-support [text-wrap:pretty]"
          >
            <p>We check your file against the official UKVI, IRCC and Home Affairs rules.</p>
            {/* Own line — breaking "take / 28 days" mid-phrase read as an accident. */}
            <p className="mt-2 font-semibold text-ink">
              Some fixes take 28 days. Find out while you still have them.
            </p>
          </motion.div>

          <motion.div {...fadeRise(reduced, T.ctaRow, 0.45)} className="mt-9 flex flex-wrap items-start gap-6">
            <div className="flex flex-col items-start">
              <Link
                href={CHECKER_HREF}
                className="rounded-[3px] bg-stamp px-6 py-3.5 font-body text-[15px] font-semibold text-paper transition-[background-color,transform] duration-150 hover:bg-stamp-deep hover:-translate-y-px active:translate-y-0 active:duration-75"
              >
                Get my readiness score
              </Link>
              {/* No "no sign-up" claim here — confirmed (again, on this pass)
                  that /tools/student-visa is Clerk-gated in middleware.ts AND
                  <AuthGate>, so that line would be false. See PR notes. */}
              <motion.p
                {...fadeOnly(reduced, T.microCopy)}
                className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-support"
              >
                Free · 2 minutes
              </motion.p>
            </div>
            <div className="flex flex-col items-start">
              {/* TODO(content): point at the real, ungated sample report once the
                  sample asset exists; brief requires it not be hidden behind
                  signup. Anchored to how-it-works as an interim, honest target. */}
              <Link
                href="/#how-it-works"
                className="mt-[9px] font-body text-[15px] font-medium text-ink underline decoration-hairline underline-offset-4 transition-[text-underline-offset,text-decoration-thickness] duration-[180ms] hover:decoration-2 hover:underline-offset-2 hover:decoration-stamp"
              >
                See a real report first
              </Link>
              <motion.p
                {...fadeOnly(reduced, T.microCopy)}
                className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-support"
              >
                No email needed
              </motion.p>
            </div>
          </motion.div>

          {/* Pricing is visible in the first scroll — hiding it behind signup
              reads as bait-and-switch in this market. */}
          <motion.p
            {...fadeOnly(reduced, T.microCopy)}
            className="mt-4 font-mono text-[12px] uppercase tracking-[0.1em] text-support"
          >
            Score and gaps free · Full report {FULL_REPORT_PRICE}, one time
          </motion.p>

          {/* Persistent disclaimer, repeated directly under the CTA (also in the
              footer on every page). Keeps every claim inside what the tool does. */}
          <motion.p
            {...fadeOnly(reduced, T.disclaimer)}
            className="measure mt-2 font-body text-[11px] leading-relaxed text-support"
          >
            <span className="font-body text-[15px] font-medium text-ink">We are not an agent.</span>{' '}
            We don&rsquo;t file your application and will never promise you a visa. Not immigration
            advice.
          </motion.p>

          <motion.ul
            {...fadeOnly(reduced, T.trustBar)}
            className="mt-8 flex max-w-[640px] flex-wrap items-center gap-y-3 border-t border-hairline pt-5"
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

          <AssessmentStarter reduced={reduced} delay={T.starter} />
        </div>

        {/* ── Right: the official document card ── */}
        {/* lg:mt-px: measured (Range.getBoundingClientRect on the eyebrow's
            first line's text node vs the card's top) so the card's top edge
            lands on the eyebrow's cap-height, not its taller line box. */}
        <motion.div
          className="relative overflow-visible lg:col-span-5 lg:mt-px"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={
            reduced ? { duration: 0.2, delay: T.card } : { duration: 0.6, delay: T.card, ease: EASE_DOC }
          }
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
              <RubberStamp
                label="Assessed"
                sublabel={SAMPLE_REPORT.assessedDate}
                rotate={0}
                delay={T.stamp}
                impact
              />
            </div>
          </div>
        </motion.div>
      </div>
    </Section>
  )
}

/* ── The readiness assessment slip ─────────────────────────────────────── */

function DocumentCard({ reduced }: { reduced: boolean }) {
  const [score, setScore] = useState(reduced ? SAMPLE_REPORT.score : 0)

  // Raw rAF counter (not setInterval, per brief) — decelerates into the final number.
  useEffect(() => {
    if (reduced) return
    let raf = 0
    const startAt = performance.now() + T.countStart * 1000
    const durationMs = T.countDuration * 1000
    const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

    const tick = (now: number) => {
      const elapsed = now - startAt
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick)
        return
      }
      const t = Math.min(elapsed / durationMs, 1)
      setScore(Math.round(easeOutCubic(t) * SAMPLE_REPORT.score))
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  const filled = Math.round((SAMPLE_REPORT.score / 100) * 20)
  const fileRows: [string, string][] = [['Applicant', SAMPLE_REPORT.applicant], ...SAMPLE_REPORT.fileRows]

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
              <ScoreBadge reduced={reduced} />
            </div>
          </div>

          {/* Segmented form-box meter: 20 cells, no gauges, no glow. */}
          <div aria-hidden="true" className="mt-4 flex gap-[3px]">
            {Array.from({ length: 20 }, (_, i) => {
              const isFilled = i < filled
              if (!isFilled) {
                return <span key={i} className="h-[9px] flex-1 border border-hairline bg-paper-deep" />
              }
              const segDelay = Math.max(0, countEnd - (filled - i) * 0.022)
              return (
                <motion.span
                  key={i}
                  className={`h-[9px] flex-1 border ${barBandClass(SAMPLE_REPORT.score)}`}
                  style={{ transformOrigin: 'bottom' }}
                  initial={reduced ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0.6 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.15, delay: segDelay }}
                />
              )
            })}
          </div>
        </div>

        <ul className="mt-5 space-y-2 border-t border-hairline pt-4">
          {SAMPLE_REPORT.lines.map(({ doc, detail, status }, i) => {
            const rowDelay = T.linesStart + i * T.lineStagger
            return (
              <motion.li
                key={doc}
                className="flex items-baseline justify-between gap-4"
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={reduced ? { duration: 0.2 } : { duration: 0.3, delay: rowDelay, ease: EASE_DOC }}
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink">{doc}</span>
                <motion.span
                  className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]"
                  initial={reduced ? { color: statusHex[status] } : { color: INK_HEX }}
                  animate={{ color: statusHex[status] }}
                  transition={
                    reduced ? { duration: 0 } : { duration: 0.25, delay: rowDelay + 0.2 }
                  }
                >
                  {detail}
                </motion.span>
              </motion.li>
            )
          })}
        </ul>

        <div className="mt-5 flex items-end justify-end gap-4 border-t border-hairline pt-4">
          <span className="flex items-baseline gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-support">
            <span>ParchiVisa Readiness Report</span>
            <span aria-hidden="true" className="text-hairline">
              ·
            </span>
            {SAMPLE_REPORT.formNumber}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Transitions ink → failure colour in sync with the first failing line item. */
function ScoreBadge({ reduced }: { reduced: boolean }) {
  const badgeDelay = T.linesStart + 0.2 // synced with row 0's status colour transition

  return (
    <motion.span
      className="inline-block border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
      initial={reduced ? { borderColor: FAIL_HEX, color: FAIL_TEXT_HEX } : { borderColor: INK_HEX, color: INK_HEX }}
      animate={{ borderColor: FAIL_HEX, color: FAIL_TEXT_HEX }}
      transition={reduced ? { duration: 0 } : { duration: 0.25, delay: badgeDelay }}
    >
      {SAMPLE_REPORT.badge}
    </motion.span>
  )
}
