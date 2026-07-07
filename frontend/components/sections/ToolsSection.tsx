import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  GraduationCap,
  Landmark,
  FileStack,
  ListChecks,
  CalendarClock,
  BadgeCheck,
  Route,
  FileText,
  MessagesSquare,
  Building2,
  ArrowRight,
  Clock,
  CheckCircle2,
  Bell,
} from 'lucide-react'

type Tool = {
  icon: LucideIcon
  title: string
  /** The worry this tool answers, in plain student language. */
  description: string
  features: string[]
  countries?: string[]
  status: 'active' | 'soon'
  href: string
  cta: string
}

const tools: Tool[] = [
  {
    icon: GraduationCap,
    title: 'Readiness Checker',
    description:
      'Before you spend a rupee on the application, find out where your profile is weak — and exactly how to fix it.',
    countries: ['🇬🇧 UK', '🇺🇸 USA', '🇨🇦 Canada', '🇦🇺 Australia'],
    features: ['A real readiness score', 'Every gap named', 'Fix-it recommendations'],
    status: 'active',
    href: '/tools/student-visa/countries',
    cta: 'Check my readiness',
  },
  {
    icon: Landmark,
    title: 'Bank Statement Checker',
    description:
      'The most common silent rejection. We test your figures against the real financial rules so a wrong date can’t end your application.',
    countries: ['🇬🇧 UK'],
    features: ['28-day rule check', 'Lowest-balance analysis', 'Source-linked verdicts'],
    status: 'active',
    href: '/tools/financial-document',
    cta: 'Check my finances',
  },
  {
    icon: FileStack,
    title: 'Document Guide',
    description:
      'No more guessing which paper to get first. Your exact documents, in order, from the official source — with the legal fast-track for each.',
    countries: ['🇬🇧 UK', '🇺🇸 USA', '🇨🇦 Canada', '🇦🇺 Australia'],
    features: ['Right order, no dead ends', 'Official sources only', 'Urgent legal fast-track'],
    status: 'active',
    href: '/tools/document-guide',
    cta: 'Map my documents',
  },
  {
    icon: ListChecks,
    title: 'Action Plan',
    description:
      'A score you can’t act on is just more anxiety. We turn every gap into an ordered to-do list so your next check actually moves.',
    features: ['Gaps → clear steps', 'Ordered by impact', 'Tracks as you go'],
    status: 'active',
    href: '/dashboard',
    cta: 'Build my plan',
  },
  {
    icon: CalendarClock,
    title: 'Deadline Planner',
    description:
      'CAS, biometrics, deposits, financial hold periods — every date mapped backwards from your intake so nothing blindsides you.',
    features: ['Mapped from your intake', 'Nothing slips', 'Know what to start now'],
    status: 'active',
    href: '/timeline',
    cta: 'See my timeline',
  },
  {
    icon: Route,
    title: 'Guided Journey',
    description:
      'Doing this alone is the hardest part. Follow a clear path from first check to visa day — and see what worked for students like you.',
    features: ['Step-by-step path', 'Real student outcomes', 'No agent required'],
    status: 'active',
    href: '/dashboard',
    cta: 'Start my journey',
  },
  {
    icon: BadgeCheck,
    title: 'Trust & Rule Freshness',
    description:
      'Rules change quietly and old checklists get people refused. See when each rule was last reviewed and where it came from.',
    features: ['Every rule dated', 'Traced to its source', 'Updated as rules change'],
    status: 'active',
    href: '/trust',
    cta: 'See our sources',
  },
  {
    icon: FileText,
    title: 'SOP Reviewer',
    description:
      'Officers read thousands of statements. We’ll read yours the way they do — flagging the lines that quietly signal a non-genuine student.',
    features: ['Officer’s-eye feedback', 'Genuineness & ties-to-home', 'Refusal-risk flags'],
    status: 'soon',
    href: '/tools/sop-review',
    cta: 'Get notified',
  },
  {
    icon: MessagesSquare,
    title: 'Mock Interview',
    description:
      'The credibility interview makes or breaks it. Practise a realistic one as many times as you need, scored on what officers listen for.',
    features: ['Realistic questions', 'Practise until ready', 'Scored assessment'],
    status: 'soon',
    href: '/tools/mock-interview',
    cta: 'Get notified',
  },
  {
    icon: Building2,
    title: 'Agency Workspace',
    description:
      'For consultants who refuse to guess with a student’s future — manage every client file, score and deadline in one honest workspace.',
    features: ['All your students, one view', 'Shared readiness & files', 'Built for agencies'],
    status: 'soon',
    href: '/consultant',
    cta: 'Get notified',
  },
]

export function ToolsSection() {
  return (
    <section className="section" id="tools">
      <div className="container-inner">
        {/* Section header */}
        <div className="text-center mb-14">
          <p className="section-label mb-3">Everything we do</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            One toolkit for the whole journey
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Every tool exists to remove one reason a genuine student gets refused — from your first
            readiness check to the morning of your interview.
          </p>
        </div>

        {/* Tools grid */}
        <div className="grid lg:grid-cols-3 gap-5">
          {tools.map((tool) => {
            const { icon: Icon, title, description, countries, features, status, href, cta } = tool
            const isActive = status === 'active'

            const CardContent = (
              <div
                className={`relative flex flex-col h-full rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isActive
                    ? 'glass border-brand-700/30 hover:border-brand-500/50 hover:-translate-y-1 shadow-xl shadow-brand-900/30 cursor-pointer'
                    : 'bg-white/[0.02] border-white/6 hover:border-white/12 cursor-pointer'
                }`}
              >
                {/* Top gradient strip */}
                <div
                  className={`h-1 w-full bg-gradient-to-r ${
                    isActive ? 'from-brand-600 to-brand-500' : 'from-slate-700 to-slate-600'
                  }`}
                />

                <div className="p-7 flex flex-col flex-1">
                  {/* Icon + badges */}
                  <div className="flex items-start justify-between mb-5">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg ${
                        isActive ? 'from-brand-600 to-brand-500' : 'from-slate-700 to-slate-600'
                      }`}
                    >
                      <Icon size={22} className="text-white" />
                    </div>
                    {isActive ? (
                      <span className="badge-green flex items-center gap-1.5 text-xs font-semibold">
                        <CheckCircle2 size={11} />
                        Live
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800/60 text-slate-400 border border-white/6">
                        <Clock size={10} />
                        Coming Soon
                      </span>
                    )}
                  </div>

                  {/* Text */}
                  <h3 className={`text-lg font-bold mb-2 ${isActive ? 'text-white' : 'text-slate-300'}`}>
                    {title}
                  </h3>
                  <p className={`text-sm leading-relaxed mb-5 ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                    {description}
                  </p>

                  {/* Features list */}
                  <ul className="space-y-2 mb-6 flex-1">
                    {features.map((f) => (
                      <li
                        key={f}
                        className={`flex items-center gap-2 text-xs ${isActive ? 'text-slate-400' : 'text-slate-500'}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-brand-400' : 'bg-slate-600'}`}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Countries */}
                  {countries && (
                    <div className="flex flex-wrap gap-1.5 mb-6">
                      {countries.map((c) => (
                        <span
                          key={c}
                          className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                            isActive ? 'bg-white/8 text-slate-300 border border-white/10' : 'bg-white/4 text-slate-500'
                          }`}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  {isActive ? (
                    <div className="flex items-center gap-1.5 text-brand-400 text-sm font-semibold group-hover:gap-2.5 transition-all">
                      {cta}
                      <ArrowRight size={15} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-400 text-sm font-semibold group-hover:gap-2.5 transition-all">
                      <Bell size={13} />
                      {cta}
                    </div>
                  )}
                </div>
              </div>
            )

            return (
              <Link key={title} href={href} className="group block h-full">
                {CardContent}
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
