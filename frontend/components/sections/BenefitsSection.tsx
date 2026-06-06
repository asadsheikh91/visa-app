import {
  FileCheck,
  Globe,
  BarChart3,
  Target,
  GraduationCap,
  DollarSign,
} from 'lucide-react'

const benefits = [
  {
    icon: FileCheck,
    title: 'Document-readiness guidance',
    description:
      'Know exactly which documents you need, which you\'re missing, and what specific format or condition each one must be in — before submission.',
  },
  {
    icon: Globe,
    title: 'Country-specific visa logic',
    description:
      'Every question, every score, every recommendation is tailored to the exact visa route and destination country you\'re applying for. No generic checklists.',
  },
  {
    icon: BarChart3,
    title: 'Clear, honest scoring system',
    description:
      'Your readiness score tells you where you actually stand — from Not Ready to Ready — with critical blockers and warnings ranked by impact.',
  },
  {
    icon: Target,
    title: 'Better preparation before applying',
    description:
      'Fix the gaps first. Applying with a complete, well-prepared application significantly increases approval chances and avoids costly refusals.',
  },
  {
    icon: GraduationCap,
    title: 'Reduced confusion for students',
    description:
      'The international student visa process is overwhelming. ParchiVisa cuts through the noise with clear, step-by-step readiness checks designed for students.',
  },
  {
    icon: DollarSign,
    title: 'Stop wasting application fees',
    description:
      'Visa fees are non-refundable. A single prevented rejection pays for the platform many times over. Know before you pay.',
  },
]

export function BenefitsSection() {
  return (
    <section className="section" id="benefits">
      <div className="container-inner">
        <div className="text-center mb-14">
          <p className="section-label mb-3">Why ParchiVisa</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Built for applicants who can&apos;t afford to guess
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Visa applications aren&apos;t just paperwork — they&apos;re high-stakes, non-refundable decisions. ParchiVisa gives you clarity on exactly where you stand.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {benefits.map(({ icon: Icon, title, description }) => (
            <div key={title} className="card group">
              <div className="w-10 h-10 rounded-xl bg-brand-900/40 border border-brand-700/30 flex items-center justify-center mb-4 group-hover:bg-brand-800/50 transition-colors duration-200">
                <Icon size={18} className="text-brand-400" />
              </div>
              <h3 className="font-semibold text-white mb-2 text-[15px]">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
