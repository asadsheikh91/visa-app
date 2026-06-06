import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ShieldCheck, Target, Scale } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About — ParchiVisa',
  description: 'ParchiVisa helps student visa applicants understand their readiness before they apply — reducing avoidable refusals through clear, honest guidance.',
}

const values = [
  { icon: Target, title: 'Clarity before you apply', body: 'We turn dense visa requirements into a clear readiness picture so you know exactly where you stand.' },
  { icon: ShieldCheck, title: 'Honest, never overpromising', body: 'We never claim to guarantee approval. We show how ready your application looks and what to fix.' },
  { icon: Scale, title: 'Grounded in official guidance', body: 'Our questions and scoring are built from each destination’s published requirements.' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-16">
      <div className="relative">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 relative">
          <p className="section-label mb-3">About ParchiVisa</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Know your visa readiness before you apply.
          </h1>
          <p className="text-slate-400 leading-relaxed">
            A visa refusal can cost a non-refundable fee, lost time, and a missed intake. ParchiVisa
            reviews your profile and documents against your destination&apos;s requirements and shows how
            ready your application looks — with clear gaps to fix first. It&apos;s an informational
            readiness check, not legal advice and not a guarantee of approval.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid sm:grid-cols-3 gap-4">
          {values.map(({ icon: Icon, title, body }) => (
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
            Check your readiness
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
