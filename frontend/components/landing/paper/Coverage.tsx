'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { RubberStamp } from './RubberStamp'
import { Section } from './Section'

type Country = {
  slug: string
  code: string
  name: string
  route: string
  checks: { label: string; body: string }[]
  trap: string
}

/**
 * Country coverage as a literal case file: folder tabs along the top, one
 * dossier open at a time. Route names mirror the checker's own country pages.
 */
const countries: Country[] = [
  {
    slug: 'uk',
    code: 'GBR',
    name: 'United Kingdom',
    route: 'Student Visa',
    checks: [
      {
        label: 'Maintenance funds',
        body: '28 consecutive days of held funds, in an acceptable account, at the level your city requires.',
      },
      {
        label: 'CAS + offer letter',
        body: 'Your CAS statement has to match your documents exactly — a single mismatch reads as deception.',
      },
      {
        label: 'TB certificate',
        body: 'Required for applicants from Pakistan, from an approved clinic, inside its validity window.',
      },
    ],
    trap: 'Most UK refusals break on the 28-day rule — money that was “always there” but moved between accounts at the wrong moment.',
  },
  {
    slug: 'australia',
    code: 'AUS',
    name: 'Australia',
    route: 'Subclass 500',
    checks: [
      {
        label: 'Genuine Student statement',
        body: 'Officers read your GS answers against your academic and financial history — not your intentions.',
      },
      {
        label: 'Financial capacity',
        body: 'Evidence of funds for tuition, living costs and travel, from sources you can document.',
      },
      {
        label: 'OSHC health cover',
        body: 'Overseas student health cover for the full length of your stay, purchased before you apply.',
      },
    ],
    trap: 'The GS statement is where Subclass 500 files die — generic answers copied from templates are refused in bulk.',
  },
  {
    slug: 'canada',
    code: 'CAN',
    name: 'Canada',
    route: 'Study Permit',
    checks: [
      {
        label: 'GIC + first-year tuition',
        body: 'A guaranteed investment certificate plus proof your first year of tuition is paid or held.',
      },
      {
        label: 'Provincial attestation',
        body: 'Most study permits now need a provincial attestation letter before IRCC will look at your file.',
      },
      {
        label: 'Letter of explanation',
        body: 'Why Canada, why this program, why now — argued against your own academic history.',
      },
    ],
    trap: 'A clean GIC won’t save a letter of explanation that doesn’t answer “why this program, after that degree?”',
  },
  {
    slug: 'usa',
    code: 'USA',
    name: 'United States',
    route: 'F-1 Visa',
    checks: [
      {
        label: 'I-20 + SEVIS',
        body: 'Your I-20 details, SEVIS fee receipt and DS-160 answers have to agree with each other exactly.',
      },
      {
        label: 'Funding for year one',
        body: 'Liquid, documented funds covering the first year — and a credible story for the years after.',
      },
      {
        label: 'Interview readiness',
        body: 'Ties to Pakistan, program fit, sponsor credibility — answered in seconds, not paragraphs.',
      },
    ],
    trap: 'The F-1 is decided in a 90-second interview — your papers only matter if your answers match them.',
  },
]

export function Coverage() {
  const [active, setActive] = useState(0)
  const reduced = useReducedMotion() ?? false
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const country = countries[active]

  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (active + dir + countries.length) % countries.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <Section
      id="coverage"
      aria-labelledby="coverage-heading"
      tone="paper"
      railed
      railNumber="§ 02"
      railCaption="Rules sourced from UKVI · IRCC · DHA · USCIS"
    >
      <div>
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-support">
          Coverage
        </p>
        <h2
          id="coverage-heading"
          className="mt-4 max-w-[24ch] font-serif text-[34px] font-medium leading-[1.1] tracking-[-0.01em] text-ink sm:text-[40px]"
        >
          Four destinations, one standard of <em className="italic">scrutiny</em>.
        </h2>

        {/* ── Folder tabs ── */}
        <div
          role="tablist"
          aria-label="Destination countries"
          onKeyDown={onKeyDown}
          className="mt-10 flex flex-wrap gap-1.5"
        >
          {countries.map((c, i) => {
            const selected = i === active
            return (
              <button
                key={c.slug}
                ref={(el) => {
                  tabRefs.current[i] = el
                }}
                role="tab"
                id={`coverage-tab-${c.slug}`}
                aria-selected={selected}
                aria-controls={`coverage-panel-${c.slug}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                className={`relative -mb-px rounded-t-[4px] border px-4 py-2.5 text-left transition-colors sm:px-5 ${
                  selected
                    ? 'z-10 border-ink border-b-white bg-white text-ink'
                    : 'border-hairline bg-paper-deep text-support hover:bg-white hover:text-ink'
                }`}
              >
                <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
                  {c.code}
                </span>
                <span className="mt-0.5 hidden font-body text-[13px] font-medium sm:block">
                  {c.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Open dossier ── */}
        <div
          role="tabpanel"
          id={`coverage-panel-${country.slug}`}
          aria-labelledby={`coverage-tab-${country.slug}`}
          className="relative border border-ink bg-white shadow-[6px_6px_0_0] shadow-ink/10"
        >
          <motion.div
            key={country.slug}
            initial={reduced ? undefined : { opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 gap-10 px-6 py-8 sm:px-8 lg:grid-cols-12 lg:py-10"
          >
            <div className="lg:col-span-7">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline pb-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink">
                  {country.name} — {country.route}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-support">
                  What the officer checks
                </span>
              </div>
              <dl className="mt-5 space-y-5">
                {country.checks.map((check) => (
                  <div key={check.label} className="grid grid-cols-1 gap-1 sm:grid-cols-[180px_1fr] sm:gap-5">
                    <dt className="font-mono text-[11px] font-bold uppercase leading-relaxed tracking-[0.12em] text-stamp">
                      {check.label}
                    </dt>
                    <dd className="measure font-body text-[14.5px] leading-relaxed text-support">
                      {check.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="border-t border-hairline pt-6 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-support">
                The common trap
              </div>
              <p className="mt-3 font-serif text-[19px] italic leading-snug text-ink">
                {country.trap}
              </p>
              <Link
                href={`/tools/student-visa/countries/${country.slug}`}
                className="mt-6 inline-block rounded-[3px] bg-stamp px-5 py-3 font-body text-[14px] font-semibold text-paper transition-colors hover:bg-stamp-deep"
              >
                Run the {country.code} check
              </Link>
              <div className="mt-8 flex justify-end">
                <RubberStamp
                  key={country.slug}
                  label={`${country.code} ✓`}
                  sublabel="Rules current"
                  size="sm"
                  rotate={-6}
                  delay={0.25}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </Section>
  )
}
