'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Section } from './Section'

/**
 * Testimonial as an editorial pull-quote — one voice, set large between
 * hairline rules, magazine-style. The quote deliberately echoes the
 * § FIN-28(b) clause from "Where applications fail."
 * Motion: a single quiet fade in place.
 */
export function PullQuote() {
  const reduced = useReducedMotion() ?? false

  return (
    <Section aria-labelledby="quote-heading" tone="paper">
      <h2 id="quote-heading" className="sr-only">
        What students say
      </h2>
      <div className="mx-auto max-w-[860px]">
        <motion.figure
          initial={reduced ? undefined : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55 }}
          className="border-y border-hairline py-14 text-center"
        >
          <div aria-hidden="true" className="font-serif text-[80px] leading-[0.5] text-stamp">
            &ldquo;
          </div>
          <blockquote className="mx-auto mt-8 max-w-[26ch] text-balance font-serif text-[28px] font-medium leading-[1.25] tracking-[-0.01em] text-ink sm:text-[34px]">
            I had no idea my funds had to sit untouched for{' '}
            <em className="italic underline decoration-stamp decoration-2 underline-offset-4">
              28 days
            </em>
. ParchiVisa caught it before I booked biometrics.
          </blockquote>
          <figcaption className="mt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-support">
            Ayesha Khan&ensp;·&ensp;Lahore → UK Student Visa
          </figcaption>
        </motion.figure>
      </div>
    </Section>
  )
}
