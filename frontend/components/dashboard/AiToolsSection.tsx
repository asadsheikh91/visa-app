'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { FileText, MessagesSquare, ShieldCheck, /* BadgeCheck, */ ArrowRight, Sparkles, Clock } from 'lucide-react'

type Tool = {
  href: string
  icon: LucideIcon
  title: string
  desc: string
  status: 'live' | 'soon'
}

const TOOLS: Tool[] = [
  {
    href: '/tools/financial-document',
    icon: ShieldCheck,
    title: 'Bank statement checker',
    desc: 'Enter your statement figures — we check them against the UK financial rules (28-day rule, balance, recency). Our rules decide, not AI.',
    status: 'live',
  },
  // Hidden from the dashboard for now — restore by uncommenting.
  // {
  //   href: '/trust',
  //   icon: BadgeCheck,
  //   title: 'Trust & rule freshness',
  //   desc: 'See when each destination’s rules were last reviewed and what changed — every check traceable to an official source.',
  //   status: 'live',
  // },
  {
    href: '/tools/sop-review',
    icon: FileText,
    title: 'SOP reviewer',
    desc: 'An officer’s-eye read on your statement — genuineness, ties to home, and the lines that quietly signal a refusal.',
    status: 'soon',
  },
  {
    href: '/tools/mock-interview',
    icon: MessagesSquare,
    title: 'Mock interview',
    desc: 'Practise a realistic credibility interview as many times as you need, scored on what officers actually listen for.',
    status: 'soon',
  },
]

/** Dashboard entry points for the readiness & coaching tools. */
export function AiToolsSection() {
  return (
    <section className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-brand-400" />
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Your toolkit
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TOOLS.map(({ href, icon: Icon, title, desc, status }) => {
          const live = status === 'live'
          return (
            <Link
              key={href}
              href={href}
              className={`group rounded-xl border p-4 transition-all hover:-translate-y-0.5 ${
                live
                  ? 'border-white/10 bg-white/[0.02] hover:border-brand-500/30 hover:bg-white/[0.04]'
                  : 'border-white/8 bg-white/[0.01] hover:border-white/15'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                      live ? 'bg-brand-500/10 border-brand-500/20' : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <Icon size={15} className={live ? 'text-brand-400' : 'text-slate-400'} />
                  </div>
                  <p className={`text-sm font-bold truncate ${live ? 'text-white' : 'text-slate-300'}`}>{title}</p>
                </div>
                {!live && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800/60 text-slate-400 border border-white/6 flex-shrink-0">
                    <Clock size={9} />
                    Soon
                  </span>
                )}
              </div>
              <p className={`text-xs leading-relaxed ${live ? 'text-slate-400' : 'text-slate-500'}`}>{desc}</p>
              <span
                className={`inline-flex items-center gap-1 text-xs mt-3 ${
                  live ? 'text-brand-400 group-hover:text-brand-300' : 'text-slate-500'
                }`}
              >
                {live ? 'Open' : 'Preview & get notified'} <ArrowRight size={12} />
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
