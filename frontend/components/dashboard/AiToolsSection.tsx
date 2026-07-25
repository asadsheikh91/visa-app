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
    <section className="rounded-[4px] border border-hairline bg-white p-5 shadow-[6px_6px_0_0] shadow-ink/10 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={16} className="text-stamp" />
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
          Your toolkit
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TOOLS.map(({ href, icon: Icon, title, desc, status }) => {
          const live = status === 'live'
          return (
            <Link
              key={href}
              href={href}
              className={`group rounded-[3px] border p-4 transition-colors ${
                live
                  ? 'border-hairline bg-white hover:border-stamp'
                  : 'border-hairline bg-paper-deep hover:border-support'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[4px] border border-hairline bg-paper">
                    <Icon size={15} className={live ? 'text-stamp' : 'text-support'} />
                  </div>
                  <p className={`truncate font-body text-sm font-bold ${live ? 'text-ink' : 'text-support'}`}>{title}</p>
                </div>
                {!live && (
                  <span className="flex flex-shrink-0 items-center gap-1 rounded-[3px] border border-hairline bg-paper px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-support">
                    <Clock size={9} />
                    Soon
                  </span>
                )}
              </div>
              <p className={`font-body text-xs leading-relaxed ${live ? 'text-support' : 'text-support'}`}>{desc}</p>
              <span
                className={`mt-3 inline-flex items-center gap-1 font-body text-xs ${
                  live ? 'text-stamp group-hover:text-stamp-deep' : 'text-support'
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
