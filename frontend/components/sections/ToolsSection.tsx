import Link from 'next/link'
import { GraduationCap, Plane, Briefcase, ArrowRight, Lock, CheckCircle2 } from 'lucide-react'

const tools = [
  {
    icon: GraduationCap,
    title: 'Student Visa Readiness Checker',
    description:
      'Check your readiness for student visas to the UK, USA, Canada, and Australia. Get a detailed score with specific document gaps and fixes.',
    countries: ['🇬🇧 UK', '🇺🇸 USA', '🇨🇦 Canada', '🇦🇺 Australia'],
    features: ['Document checklist', 'Readiness score', 'AI recommendations'],
    status: 'active',
    href: '/tools/student-visa',
    color: 'from-brand-600 to-brand-500',
    glowColor: 'shadow-brand-900/30',
  },
  {
    icon: Plane,
    title: 'Tourist Visa Checker',
    description:
      'Evaluate your tourist visa application readiness for Schengen, UK, and other popular destinations. Coming soon.',
    countries: ['🇪🇺 Schengen', '🇬🇧 UK', '🇺🇸 USA', '+ more'],
    features: ['Trip purpose review', 'Financial assessment', 'Itinerary check'],
    status: 'soon',
    href: '#',
    color: 'from-slate-600 to-slate-500',
    glowColor: 'shadow-slate-900/30',
  },
  {
    icon: Briefcase,
    title: 'Business Visa Checker',
    description:
      'Prepare your business visa application with confidence. Get a readiness assessment for business travel visas. Coming soon.',
    countries: ['🇺🇸 USA', '🇬🇧 UK', '🇩🇪 Germany', '+ more'],
    features: ['Invitation letter review', 'Financial docs', 'Travel history'],
    status: 'soon',
    href: '#',
    color: 'from-slate-600 to-slate-500',
    glowColor: 'shadow-slate-900/30',
  },
]

export function ToolsSection() {
  return (
    <section className="section" id="tools">
      <div className="container-inner">
        {/* Section header */}
        <div className="text-center mb-14">
          <p className="section-label mb-3">Our tools</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Visa readiness for every journey
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Each tool is purpose-built for a specific visa category — with country-specific questions, scoring, and actionable recommendations.
          </p>
        </div>

        {/* Tools grid */}
        <div className="grid lg:grid-cols-3 gap-5">
          {tools.map(({ icon: Icon, title, description, countries, features, status, href, color, glowColor }) => {
            const isActive = status === 'active'

            const CardContent = (
              <div
                className={`relative flex flex-col h-full rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isActive
                    ? `glass border-brand-700/30 hover:border-brand-500/50 hover:-translate-y-1 shadow-xl ${glowColor} cursor-pointer`
                    : 'bg-white/[0.02] border-white/6 opacity-70'
                }`}
              >
                {/* Top gradient strip */}
                <div className={`h-1 w-full bg-gradient-to-r ${color}`} />

                <div className="p-7 flex flex-col flex-1">
                  {/* Icon + badges */}
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                      <Icon size={22} className="text-white" />
                    </div>
                    {isActive ? (
                      <span className="badge-green flex items-center gap-1.5 text-xs font-semibold">
                        <CheckCircle2 size={11} />
                        Live
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800/60 text-slate-500 border border-white/6">
                        <Lock size={10} />
                        Coming Soon
                      </span>
                    )}
                  </div>

                  {/* Text */}
                  <h3 className={`text-lg font-bold mb-2 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {title}
                  </h3>
                  <p className={`text-sm leading-relaxed mb-5 ${isActive ? 'text-slate-400' : 'text-slate-600'}`}>
                    {description}
                  </p>

                  {/* Features list */}
                  <ul className="space-y-2 mb-6 flex-1">
                    {features.map((f) => (
                      <li key={f} className={`flex items-center gap-2 text-xs ${isActive ? 'text-slate-400' : 'text-slate-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-brand-400' : 'bg-slate-600'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Countries */}
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {countries.map((c) => (
                      <span key={c} className={`text-xs px-2 py-0.5 rounded-md font-medium ${isActive ? 'bg-white/8 text-slate-300 border border-white/10' : 'bg-white/4 text-slate-600'}`}>
                        {c}
                      </span>
                    ))}
                  </div>

                  {/* CTA */}
                  {isActive ? (
                    <div className="flex items-center gap-1.5 text-brand-400 text-sm font-semibold group-hover:gap-2.5 transition-all">
                      Start Check
                      <ArrowRight size={15} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-600 text-sm font-semibold">
                      <Lock size={13} />
                      Notify me
                    </div>
                  )}
                </div>
              </div>
            )

            return isActive ? (
              <Link key={title} href={href} className="group block h-full">
                {CardContent}
              </Link>
            ) : (
              <div key={title} className="h-full">
                {CardContent}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
