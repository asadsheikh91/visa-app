import { FileText, ClipboardList, BarChart3, ArrowRight } from 'lucide-react'

const steps = [
  {
    step: '01',
    icon: FileText,
    title: 'Provide your visa details',
    description:
      'Select your destination country and visa type. We load the exact checklist, document requirements, and scoring criteria for that specific route.',
    detail: 'UK · USA · Canada · Australia',
  },
  {
    step: '02',
    icon: ClipboardList,
    title: 'Check documents & readiness signals',
    description:
      'Work through targeted questions about your documents, finances, academic history, and personal circumstances. No guesswork — just structured assessment.',
    detail: 'Takes under 5 minutes',
  },
  {
    step: '03',
    icon: BarChart3,
    title: 'Receive your score & improvement plan',
    description:
      'Get a precise readiness score with critical blockers, warnings, and specific action steps — so you know exactly what to fix before submitting.',
    detail: 'Actionable. Specific. Instant.',
  },
]

export function HowItWorksSection() {
  return (
    <section className="relative section" id="how-it-works">
      <div className="container-inner relative">
        <div className="text-center mb-14">
          <p className="section-label mb-3">The process</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Three steps to clarity
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            No jargon, no confusion. A structured readiness check that mirrors the actual visa evaluation process — in minutes.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* Desktop connector line */}
          <div
            className="hidden md:block absolute top-[42px] left-[calc(33%+24px)] right-[calc(33%+24px)] h-px pointer-events-none"
            style={{
              background: 'linear-gradient(to right, rgba(103,59,255,0.3), rgba(255,255,255,0.05), rgba(103,59,255,0.3))',
              zIndex: 0,
            }}
          />

          {steps.map(({ step, icon: Icon, title, description, detail }, i) => (
            <div key={step} className="relative">
              <div className="card h-full space-y-5 relative z-10">
                {/* Step icon row */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-600/20 to-accent-600/10 border border-brand-600/30 flex items-center justify-center">
                      <Icon size={20} className="text-brand-400" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface-900 border border-brand-600/40 flex items-center justify-center text-[9px] font-bold text-brand-400">
                      {step}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowRight size={14} className="text-slate-700 hidden md:block ml-auto" />
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
                </div>

                <div className="pt-2 border-t border-white/6">
                  <span className="text-xs font-semibold text-brand-400">{detail}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <a href="/tools/student-visa" className="btn-secondary inline-flex items-center gap-2">
            Try it now — it&apos;s free
            <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </section>
  )
}
