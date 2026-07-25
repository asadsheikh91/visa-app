import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ClipboardCheck, Gauge, ListChecks } from 'lucide-react'
import { CheckerHeader } from '@/components/checker/CheckerHeader'

export const metadata: Metadata = {
  title: 'Student Visa Readiness Checker — ParchiVisa',
  description: 'Understand how ready your student visa application is before you apply — country-specific questions, a readiness score, and clear gaps to fix.',
}

const steps = [
  { icon: ClipboardCheck, title: 'Answer a few questions', body: 'Country-specific questions about your profile and documents — takes a few minutes.' },
  { icon: Gauge, title: 'Get a readiness score', body: 'See how ready your application looks, from “Not ready” to “Ready”, with the reasoning.' },
  { icon: ListChecks, title: 'Fix the gaps', body: 'Clear blockers, warnings, and recommendations to address before you apply.' },
]

export default function StudentVisaOverview() {
  return (
    <div className="min-h-screen pt-16">
      <CheckerHeader
        title="Student Visa Readiness Checker"
        subtitle="UK · USA · Canada · Australia"
        backHref="/tools"
        backLabel="Back to tools"
      />

      <div className="mx-auto max-w-3xl px-gutter py-12">
        <p className="max-w-measure font-body text-[17px] leading-relaxed text-support">
          ParchiVisa reviews your profile and documents against the destination&apos;s requirements,
          then shows how ready your application looks — with the specific gaps to fix before you apply.
          This is an informational readiness check, not legal advice or a guarantee of approval.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="rounded-[4px] border border-hairline bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-support">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-hairline bg-paper">
                  <Icon size={17} className="text-stamp" />
                </div>
              </div>
              <h3 className="mb-1.5 font-serif text-[17px] leading-tight text-ink">{title}</h3>
              <p className="font-body text-[13px] leading-relaxed text-support">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Link href="/tools/student-visa/countries" className="btn-primary">
            Choose your country
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
