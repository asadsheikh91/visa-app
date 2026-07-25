'use client'

import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import { RubberStamp } from './RubberStamp'
import { Section } from './Section'

/**
 * "How it works" — a processing ledger. The ONLY numbered sequence on the
 * page, because these steps genuinely happen in order. Each checkpoint pairs
 * the student's action with the file's official status, stamped in the margin.
 * The rail draws with scroll progress; rows fade in place (no fade-up).
 */
const steps: {
  n: string
  title: string
  body: string
  stamp: string
  sub?: string
  rotate: number
}[] = [
  {
    n: '01',
    title: 'Open your file',
    body: 'Answer a two-minute questionnaire — country, program, funds. No documents needed yet, no account required to start.',
    stamp: 'Received',
    rotate: -6,
  },
  {
    n: '02',
    title: 'The engine reads it like an officer',
    body: 'Your answers are tested against the official rules for your route — the hold periods, thresholds and validity windows that decide real cases.',
    stamp: 'In review',
    rotate: 4,
  },
  {
    n: '03',
    title: 'Get the verdict early',
    body: 'A readiness score with every weak spot named — the refusal letter you never receive, delivered while it can still be fixed.',
    stamp: 'Assessed',
    rotate: -5,
  },
  {
    n: '04',
    title: 'Fix, re-check, apply',
    body: 'Work the ordered action plan, watch the score move, and submit knowing what the embassy will see before the embassy sees it.',
    stamp: 'Ready ✓',
    sub: 'PV · Approved to apply',
    rotate: -8,
  },
]

export function HowItWorks() {
  const reduced = useReducedMotion() ?? false
  const railRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ['start 0.75', 'end 0.6'],
  })
  const drawn = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })
  const scaleY = useTransform(drawn, [0, 1], [0, 1])

  return (
    <Section id="how-it-works" aria-labelledby="how-heading" tone="paper-alt" railed>
      <div>
        <div className="max-w-[560px]">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-support">
            Processing timeline
          </p>
          <h2
            id="how-heading"
            className="mt-4 font-serif text-[34px] font-medium leading-[1.1] tracking-[-0.01em] text-ink sm:text-[40px]"
          >
            Your file, processed <em className="italic">before</em> you submit it.
          </h2>
        </div>

        <div ref={railRef} className="relative mt-14 max-w-[860px]">
          {/* The rail: hairline base + ink line drawn by scroll progress */}
          <div aria-hidden="true" className="absolute bottom-3 left-[7px] top-3 w-px bg-hairline" />
          <motion.div
            aria-hidden="true"
            className="absolute bottom-3 left-[7px] top-3 w-px origin-top bg-stamp"
            style={reduced ? undefined : { scaleY }}
          />

          <ol className="space-y-14">
            {steps.map((step, i) => (
              <motion.li
                key={step.n}
                // The 190px stamp column only appears at lg. At sm/md the
                // rotated stamp is wider than the column and overran the
                // container (22px of horizontal scroll at 768).
                className="relative grid grid-cols-[36px_1fr] gap-4 sm:gap-6 lg:grid-cols-[56px_1fr_190px]"
                initial={reduced ? undefined : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.4, delay: 0.05 }}
              >
                {/* Checkpoint node on the rail */}
                <div className="pt-[6px]">
                  <span
                    aria-hidden="true"
                    className="ml-[3px] block h-[9px] w-[9px] border border-ink bg-paper-deep"
                  />
                  <span className="mt-3 block font-mono text-[12px] font-bold tracking-[0.08em] text-support">
                    {step.n}
                  </span>
                </div>

                <div>
                  <h3 className="font-serif text-[23px] font-medium leading-snug text-ink">
                    {step.title}
                  </h3>
                  <p className="measure mt-2 font-body text-[15px] leading-relaxed text-support">
                    {step.body}
                  </p>
                </div>

                {/* Margin stamp — the file's official status at this checkpoint */}
                <div className="col-start-2 mt-1 lg:col-start-3 lg:mt-0 lg:justify-self-end lg:pt-1">
                  <RubberStamp
                    label={step.stamp}
                    sublabel={step.sub}
                    size="sm"
                    rotate={step.rotate}
                    delay={0.2}
                    color={i === steps.length - 1 ? 'stamp' : 'ink'}
                    className={i === steps.length - 1 ? '' : 'opacity-70'}
                  />
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  )
}
