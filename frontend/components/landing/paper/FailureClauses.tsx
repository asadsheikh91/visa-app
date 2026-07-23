'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Section } from './Section'

/**
 * "Where applications fail" — set as a regulation excerpt, because that is how
 * refusals actually arrive: a letter citing clauses. The refs are ParchiVisa's
 * own refusal taxonomy (footnoted as such), NOT fake statute numbers, and NOT
 * a decorative 01/02/03 sequence — these grounds have no order.
 *
 * Motion: hairline rules draw in (scaleX) and text fades — no fade-up here.
 */
const clauses: {
  ref: string
  title: string
  body: string
  module: string
  href: string
}[] = [
  {
    ref: '§ FIN-28(b)',
    title: 'The 28-day rule breaks silently',
    body: 'The money was there — but it landed three days late, or sat in the wrong account, and broke the required hold period. There is no appeal for this.',
    module: 'Bank Statement Checker',
    href: '/tools/financial-document',
  },
  {
    ref: '§ PRO-RDY(a)',
    title: 'Applying on a guess',
    body: 'You get one application per intake. Submit a weak file and the refusal letter won’t say what went wrong — only that it did.',
    module: 'Readiness Checker',
    href: '/tools/student-visa/countries',
  },
  {
    ref: '§ DOC-SEQ(c)',
    title: 'Documents fetched in the wrong order',
    body: 'One attestation quietly depends on another paper you don’t have yet. The embassy won’t warn you; you find out three weeks later.',
    module: 'Document Guide',
    href: '/tools/document-guide',
  },
  {
    ref: '§ TIM-DLN(d)',
    title: 'The deadline you didn’t know existed',
    body: 'CAS letters, biometrics, the tuition deposit, the financial hold — miss one date and the rest fall like dominoes. Intake gone, deposit gone.',
    module: 'Deadline Planner',
    href: '/dashboard',
  },
]

export function FailureClauses() {
  const reduced = useReducedMotion() ?? false

  return (
    <Section
      id="failures"
      aria-labelledby="failures-heading"
      tone="paper-alt"
      railed
      railNumber="§ 01"
    >
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
        {/* ── Left: sticky section header ── */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-support">
              Grounds for refusal
            </p>
            <h2
              id="failures-heading"
              className="mt-4 font-serif text-[34px] font-medium leading-[1.1] tracking-[-0.01em] text-ink sm:text-[40px]"
            >
              Where applications <em className="italic">actually</em> fail.
            </h2>
            <p className="mt-5 max-w-[38ch] font-body text-[15.5px] leading-relaxed text-support">
              Refusals arrive as a letter citing clauses. These are the four that catch genuine,
              well-funded students — each one paired with the check that removes it.
            </p>
            <p className="mt-8 border-t border-hairline pt-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-support">
              Clause refs are ParchiVisa&rsquo;s refusal taxonomy,
              <br />
              mapped to the official rules.
            </p>
          </div>
        </div>

        {/* ── Right: the clauses ── */}
        <div className="lg:col-span-8">
          {clauses.map((c, i) => (
            <motion.article
              key={c.ref}
              className="group relative"
              initial={reduced ? undefined : 'hidden'}
              whileInView="shown"
              viewport={{ once: true, amount: 0.4 }}
              transition={{ staggerChildren: 0.06, delayChildren: i * 0.04 }}
            >
              {/* Rule draws in from the left */}
              <motion.div
                aria-hidden="true"
                className="h-px origin-left bg-hairline"
                variants={{ hidden: { scaleX: 0 }, shown: { scaleX: 1 } }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
              <motion.div
                className="grid grid-cols-1 gap-3 py-7 sm:grid-cols-[130px_1fr] sm:gap-6"
                variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }}
                transition={{ duration: 0.35 }}
              >
                <div className="pt-[3px] font-mono text-[12px] font-bold tracking-[0.06em] text-support transition-colors group-hover:text-stamp">
                  {c.ref}
                </div>
                <div>
                  <h3 className="font-serif text-[22px] font-medium leading-snug text-ink">
                    {c.title}
                  </h3>
                  <p className="measure mt-2 font-body text-[15px] leading-relaxed text-support">
                    {c.body}
                  </p>
                  <Link
                    href={c.href}
                    className="mt-3 inline-flex items-baseline gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-stamp hover:underline hover:underline-offset-4"
                  >
                    <span aria-hidden="true">✓</span>
                    Caught by {c.module}
                  </Link>
                </div>
              </motion.div>
            </motion.article>
          ))}
          <div aria-hidden="true" className="h-px bg-hairline" />
        </div>
      </div>
    </Section>
  )
}
