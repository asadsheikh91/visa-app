'use client'

import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { COUNTRIES, type CountrySlug } from '@/lib/countries'
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs'
import { SectionHeader } from '@/components/ui/section-header'
import { CheckReadinessCta } from './CheckReadinessCta'

// ---------------------------------------------------------------------------
// Content keyed by slug — identity + order come from COUNTRIES. The most
// commonly documented reasons Pakistani students are refused, per country.
// Direct and factual, not alarmist.
// ---------------------------------------------------------------------------

const reasonsBySlug: Record<CountrySlug, string[]> = {
  australia: [
    'Failing the Genuine Student (GS) requirement — a generic or unconvincing statement about why you chose the course.',
    'Not enough evidence of funds to cover tuition, living costs, and travel for the full stay.',
    'Weak ties to Pakistan, leading the officer to see an intent to migrate rather than study.',
    'A course that does not line up with your previous studies or career direction.',
    'Education or employment gaps that are left unexplained in your application.',
    'Incomplete documents or English scores below the required level.',
  ],
  canada: [
    'Financial proof that does not clearly cover tuition plus living costs, including the GIC.',
    'Weak ties to home — the officer is not convinced you will leave Canada after studying.',
    'A study plan that is not credible for the program or institution you chose.',
    'Education or work gaps in your history that are not explained.',
    'Letter of acceptance issues, or a program that does not match your past education.',
    'Unclear source of sponsor funds, or large recent deposits with no explanation.',
  ],
  usa: [
    'Unable to prove strong ties to Pakistan and intent to return (Section 214(b) refusals).',
    'Insufficient or unverifiable financial support for tuition and living expenses.',
    'Vague or inconsistent answers about your study plans during the visa interview.',
    'A course or university choice that does not match your academic or career background.',
    'A sponsor relationship or income that cannot be verified.',
    'An incomplete DS-160 or missing supporting documents.',
  ],
  uk: [
    'Funds not held for the full 28-day maintenance period, or unstable financial evidence.',
    'Discrepancies in bank statements or sponsor income that cannot be explained.',
    'Weak academic progression or study gaps without a clear reason.',
    'Failing the credibility interview — unable to explain your course and university choice.',
    'Incorrect CAS details or missing required documents.',
    'English (SELT/IELTS) scores below the level required for your course.',
  ],
}

// ---------------------------------------------------------------------------
// RejectionReasons
// ---------------------------------------------------------------------------

export function RejectionReasons() {
  const [activeSlug, setActiveSlug] = useState<CountrySlug>(COUNTRIES[0].slug)
  const active = COUNTRIES.find((c) => c.slug === activeSlug) ?? COUNTRIES[0]

  return (
    <section className="relative z-10 px-4 py-10 sm:py-12" aria-labelledby="rejection-heading">
      <div className="container-inner">
        <SectionHeader
          eyebrow="Know before you go"
          title="Why student visas get refused"
          subtitle="These are the most common, well-documented reasons applicants from Pakistan are turned down — so you can fix them before you apply."
          headingId="rejection-heading"
        />

        <Tabs value={activeSlug} onValueChange={(v) => setActiveSlug(v as CountrySlug)}>
          <TabList label="Select a country" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {COUNTRIES.map((c) => (
              <Tab key={c.slug} value={c.slug}>
                <span className="text-base" aria-hidden="true">{c.flag}</span>
                {c.name}
              </Tab>
            ))}
          </TabList>

          {COUNTRIES.map((c) => (
            <TabPanel
              key={c.slug}
              value={c.slug}
              className="mt-5 border border-ink bg-white p-6 shadow-[6px_6px_0_0] shadow-ink/10 sm:p-7"
            >
              {/* Mono uppercase column header — the "section header" slot. */}
              <p className="border-b border-hairline pb-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink">
                {c.name} — documented grounds for refusal
              </p>
              <ul className="mt-5 space-y-4">
                {reasonsBySlug[c.slug].map((reason, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 font-body text-[15px] leading-relaxed text-support"
                  >
                    <AlertCircle
                      size={15}
                      className="mt-1 flex-shrink-0 text-warn-text"
                      aria-hidden="true"
                    />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </TabPanel>
          ))}
        </Tabs>

        {/* Country-specific CTA — leads into the readiness checker for this country */}
        <CheckReadinessCta
          href={`/tools/student-visa/countries/${active.slug}`}
          label={`Check Your ${active.name} Visa Readiness`}
          className="mt-10"
        />
      </div>
    </section>
  )
}
