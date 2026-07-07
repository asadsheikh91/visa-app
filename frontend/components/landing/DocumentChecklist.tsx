'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import clsx from 'clsx'
import { COUNTRIES, type CountrySlug } from '@/lib/countries'
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs'
import { SectionHeader } from '@/components/ui/section-header'
import { CheckReadinessCta } from './CheckReadinessCta'

// ---------------------------------------------------------------------------
// Content keyed by slug — identity + order come from COUNTRIES. Typical
// student-visa document requirements per country. Items marked "(if required)"
// are conditional on course/profile.
// ---------------------------------------------------------------------------

interface DocItem {
  id: string
  label: string
}

const documentsBySlug: Record<CountrySlug, DocItem[]> = {
  australia: [
    { id: 'passport', label: 'Valid passport' },
    { id: 'coe', label: 'Confirmation of Enrolment (CoE)' },
    { id: 'gs', label: 'Genuine Student (GS) statement' },
    { id: 'english', label: 'IELTS / PTE / TOEFL score report' },
    { id: 'finances', label: 'Financial capacity evidence (tuition + living + travel)' },
    { id: 'bank', label: 'Bank statements' },
    { id: 'oshc', label: 'Overseas Student Health Cover (OSHC)' },
    { id: 'transcripts', label: 'Academic transcripts & certificates' },
    { id: 'photos', label: 'Passport-size photographs' },
    { id: 'cnic', label: 'CNIC / national ID copy' },
  ],
  canada: [
    { id: 'passport', label: 'Valid passport' },
    { id: 'loa', label: 'Letter of Acceptance from a DLI' },
    { id: 'pal', label: 'Provincial Attestation Letter (PAL) (if required)' },
    { id: 'gic', label: 'Proof of funds — GIC + tuition payment' },
    { id: 'english', label: 'IELTS / TOEFL / PTE score report' },
    { id: 'bank', label: 'Bank statements' },
    { id: 'sop', label: 'Statement of Purpose (SOP)' },
    { id: 'transcripts', label: 'Academic transcripts & certificates' },
    { id: 'medical', label: 'Medical exam report (if required)' },
    { id: 'photos', label: 'Passport-size photographs' },
    { id: 'cnic', label: 'CNIC / national ID copy' },
  ],
  usa: [
    { id: 'passport', label: 'Valid passport' },
    { id: 'i20', label: 'Form I-20 from your SEVP school' },
    { id: 'sevis', label: 'SEVIS (I-901) fee payment receipt' },
    { id: 'ds160', label: 'DS-160 confirmation page' },
    { id: 'finances', label: 'Financial statements / proof of funds' },
    { id: 'bank', label: 'Bank statements' },
    { id: 'affidavit', label: 'Sponsor affidavit of support' },
    { id: 'english', label: 'IELTS / TOEFL score report' },
    { id: 'transcripts', label: 'Academic transcripts & certificates' },
    { id: 'photos', label: 'Passport-size photograph (US visa spec)' },
    { id: 'cnic', label: 'CNIC / national ID copy' },
  ],
  uk: [
    { id: 'passport', label: 'Valid passport' },
    { id: 'cas', label: 'CAS (Confirmation of Acceptance for Studies)' },
    { id: 'finances', label: 'Proof of finances — 28-day bank statements' },
    { id: 'english', label: 'IELTS / approved SELT score report' },
    { id: 'tb', label: 'Tuberculosis (TB) test certificate' },
    { id: 'sop', label: 'Statement of Purpose' },
    { id: 'transcripts', label: 'Academic transcripts & certificates' },
    { id: 'atas', label: 'ATAS certificate (if required for your course)' },
    { id: 'photos', label: 'Passport-size photographs' },
    { id: 'cnic', label: 'CNIC / national ID copy' },
  ],
}

// ---------------------------------------------------------------------------
// DocumentChecklist
// ---------------------------------------------------------------------------

export function DocumentChecklist() {
  const [activeSlug, setActiveSlug] = useState<CountrySlug>(COUNTRIES[0].slug)
  // Checked state keyed by `${slug}:${docId}` so each country tracks its own.
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const keyFor = (slug: string, docId: string) => `${slug}:${docId}`
  const toggle = (slug: string, docId: string) => {
    const key = keyFor(slug, docId)
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <section className="relative z-10 px-4 py-10 sm:py-12" aria-labelledby="checklist-heading">
      <div className="container-inner">
        <SectionHeader
          eyebrow="Get application-ready"
          title="Your document checklist"
          subtitle="Tick off what you have ready. Pick your destination to see the documents a student visa application typically needs."
          headingId="checklist-heading"
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

          {COUNTRIES.map((c) => {
            const docs = documentsBySlug[c.slug]
            const total = docs.length
            const done = docs.filter((d) => checked[keyFor(c.slug, d.id)]).length
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <TabPanel key={c.slug} value={c.slug} className="glass mt-5 rounded-2xl p-6 sm:p-7">
                {/* Progress indicator */}
                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300">{c.name} documents</span>
                    <span className="badge">{done} / {total} ready</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-tint-4">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                      role="progressbar"
                      aria-valuenow={done}
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-label={`${done} of ${total} documents ready`}
                    />
                  </div>
                </div>

                {/* Checklist */}
                <ul className="space-y-2.5">
                  {docs.map((doc) => {
                    const isChecked = !!checked[keyFor(c.slug, doc.id)]
                    return (
                      <li key={doc.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isChecked}
                          onClick={() => toggle(c.slug, doc.id)}
                          className={clsx(
                            'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-150',
                            isChecked
                              ? 'border-brand-500/40 bg-brand-600/10'
                              : 'border-line-1 bg-tint-2 hover:border-line-3 hover:bg-tint-4'
                          )}
                        >
                          <span
                            className={clsx(
                              'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2',
                              isChecked ? 'border-brand-400 bg-brand-500' : 'border-slate-600'
                            )}
                          >
                            {isChecked && <Check size={12} className="text-white" aria-hidden="true" />}
                          </span>
                          <span className={clsx(isChecked ? 'text-slate-500 line-through' : 'text-slate-300')}>
                            {doc.label}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <p className="mt-5 text-xs text-slate-600">
                  A general guide — exact requirements vary by university and your profile. Always confirm with the
                  official visa authority.
                </p>
              </TabPanel>
            )
          })}
        </Tabs>

        <CheckReadinessCta className="mt-10" />
      </div>
    </section>
  )
}
