'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Section } from './Section'

const CHECKER_HREF = '/tools/student-visa/countries'

/**
 * The one dark moment on an all-light page: a full-bleed ink band.
 * Typographic only — the drama is the contrast itself, so no stamps here.
 * seal-orange budget use 2 of 3: the attention eyebrow.
 */
export function FinalCta() {
  const reduced = useReducedMotion() ?? false

  return (
    <Section aria-labelledby="final-heading" tone="ink">
      <div className="mx-auto max-w-[860px] text-center">
        <motion.div
          initial={reduced ? undefined : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-seal">
            Before you pay the fee
          </p>
          <h2
            id="final-heading"
            className="mx-auto mt-6 max-w-[18ch] text-balance font-serif text-[40px] font-medium leading-[1.08] tracking-[-0.015em] text-paper sm:text-[52px]"
          >
            The embassy reads your file once. <em className="italic">Read it first.</em>
          </h2>
          <div className="mt-10">
            <Link
              href={CHECKER_HREF}
              className="inline-block rounded-[3px] border border-paper/25 bg-stamp px-7 py-4 font-body text-[15px] font-semibold text-paper transition-colors hover:bg-stamp-deep"
            >
              Check my readiness — free
            </Link>
          </div>
          <p className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-paper/60">
            Free readiness score&ensp;·&ensp;No card required&ensp;·&ensp;2 minutes
          </p>
        </motion.div>
      </div>
    </Section>
  )
}
