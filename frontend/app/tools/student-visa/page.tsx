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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-slate-300 text-base leading-relaxed">
          ParchiVisa reviews your profile and documents against the destination&apos;s requirements,
          then shows how ready your application looks — with the specific gaps to fix before you apply.
          This is an informational readiness check, not legal advice or a guarantee of approval.
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mt-10">
          {steps.map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-accent-600 flex items-center justify-center mb-4">
                <Icon size={18} className="text-white" />
              </div>
              <h3 className="font-semibold text-white text-sm mb-1.5">{title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Link href="/tools/student-visa/countries" className="btn-primary justify-center">
            Choose your country
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
