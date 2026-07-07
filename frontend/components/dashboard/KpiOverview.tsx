'use client'

import Link from 'next/link'
import {
  Gauge,
  FolderCheck,
  AlertTriangle,
  ListChecks,
  ArrowRight,
  ClipboardCheck,
  Lightbulb,
  Sparkles,
} from 'lucide-react'
import type { HistoryItem, VisaFile } from '@/types/visa'
import { tierFromScore } from '@/types/visa'
import { countryName, countryFlag } from '@/lib/dashboardDisplay'

interface Props {
  latestCheck: HistoryItem | null
  file:        VisaFile | null
  loading:     boolean
  onNavigate:  (section: string) => void
}

function scoreColor(score: number): string {
  const t = tierFromScore(score)
  if (t === 'ready') return 'text-emerald-400'
  if (t === 'mostly_ready') return 'text-brand-400'
  if (t === 'needs_work') return 'text-amber-400'
  return 'text-red-400'
}

// Country-specific "good to know" facts — concise, genuinely useful.
const TIPS: Record<string, string[]> = {
  uk: [
    'Funds must sit in your account for 28 consecutive days.',
    'Your bank statement must be dated within 31 days of applying.',
    'You need a CAS from your university before you can apply.',
  ],
  usa: [
    'Pay the SEVIS I-901 fee before your visa interview.',
    'Bring your I-20, DS-160 confirmation, and financial proof to the interview.',
    'Be ready to clearly explain your study plans and ties to home.',
  ],
  canada: [
    'A GIC is the simplest way to prove your living-cost funds.',
    'You need a Letter of Acceptance (LOA) from a designated institution.',
    'Many provinces now require a Provincial Attestation Letter (PAL).',
  ],
  australia: [
    'The Genuine Student (GS) requirement is assessed from your statement.',
    'Arrange OSHC health cover for your entire stay.',
    'You need a Confirmation of Enrolment (CoE) to lodge your visa.',
  ],
}
const DEFAULT_TIPS = [
  'Show your funds have been held for the required period.',
  'Keep every document official, recent, and consistent.',
  'Explain any large or unusual deposits in writing.',
]

function KpiTile({
  label, value, suffix, accent, icon: Icon, onClick,
}: {
  label: string
  value: string | number
  suffix?: string
  accent: string
  icon: typeof Gauge
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left glass rounded-2xl border border-white/10 p-4 sm:p-5 transition-all hover:-translate-y-0.5 hover:border-white/20"
    >
      <div className="flex items-center justify-between mb-2">
        <Icon size={16} className={accent} />
        <ArrowRight size={13} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>
      <p className={`text-2xl font-extrabold leading-none ${accent}`}>
        {value}<span className="text-sm text-slate-500 font-semibold">{suffix}</span>
      </p>
      <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">{label}</p>
    </button>
  )
}

export function KpiOverview({ latestCheck, file, loading, onNavigate }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="glass rounded-2xl border border-white/10 h-28 animate-pulse" />
        ))}
      </div>
    )
  }

  // ── No readiness check yet → focused empty state ─────────────────────────────
  if (!latestCheck) {
    return (
      <section className="glass rounded-2xl border border-white/10 p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
          <ClipboardCheck size={22} className="text-slate-500" />
        </div>
        <p className="text-white font-semibold mb-1">Start your visa journey</p>
        <p className="text-slate-500 text-sm mb-5 max-w-sm mx-auto">
          Run the Student Visa Readiness Checker to unlock your score, action plan, and visa file.
        </p>
        <Link href="/tools/student-visa/countries" className="btn-primary text-sm justify-center">
          Start readiness check <ArrowRight size={14} />
        </Link>
      </section>
    )
  }

  const score = latestCheck.score
  const completion = file?.stats.completion_pct ?? 0
  const criticalMissing = file?.stats.critical_missing ?? 0
  const issues =
    (latestCheck.critical_blockers?.length ?? 0) +
    (latestCheck.high_risk_flags?.length ?? 0) +
    (latestCheck.soft_warnings?.length ?? 0)

  // ── Next best action (no extra data needed) ──────────────────────────────────
  let hint: { text: string; cta: string; section: string }
  if (criticalMissing > 0) {
    hint = { text: `You have ${criticalMissing} critical document${criticalMissing > 1 ? 's' : ''} still outstanding.`, cta: 'Open visa file', section: 'visa_file' }
  } else if (issues > 0) {
    hint = { text: `${issues} flagged issue${issues > 1 ? 's' : ''} could affect your application.`, cta: 'See action plan', section: 'action_plan' }
  } else if (completion < 100) {
    hint = { text: `Your visa file is ${completion}% complete — keep building it.`, cta: 'Open visa file', section: 'visa_file' }
  } else {
    hint = { text: "You're on track. Polish your SOP and practise your interview.", cta: 'Open AI coaching', section: 'ai_tools' }
  }

  const country = (latestCheck.country || '').toLowerCase()
  const tips = TIPS[country] ?? DEFAULT_TIPS

  return (
    <div className="space-y-5">
      {/* Status strip */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span>{countryFlag(country)}</span>
        <span className="text-white font-medium">{countryName(country)}</span>
        <span className="text-slate-600">·</span>
        <span>{latestCheck.result}</span>
      </div>

      {/* Next best action hint */}
      <div className="glass rounded-2xl border border-brand-500/25 bg-brand-500/5 p-4 sm:p-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center flex-shrink-0">
          <Sparkles size={16} className="text-brand-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-brand-300 uppercase tracking-wider">Next best step</p>
          <p className="text-sm text-white mt-0.5">{hint.text}</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(hint.section)}
          className="btn-primary text-xs py-2 px-3.5 flex-shrink-0 self-center"
        >
          {hint.cta} <ArrowRight size={13} />
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile label="Readiness score" value={score} suffix=" / 100" accent={scoreColor(score)} icon={Gauge} onClick={() => onNavigate('readiness')} />
        <KpiTile label="Visa file complete" value={completion} suffix="%" accent={completion >= 100 ? 'text-emerald-400' : 'text-brand-400'} icon={FolderCheck} onClick={() => onNavigate('visa_file')} />
        <KpiTile label="Critical items left" value={criticalMissing} accent={criticalMissing > 0 ? 'text-red-400' : 'text-emerald-400'} icon={AlertTriangle} onClick={() => onNavigate('visa_file')} />
        <KpiTile label="Issues to resolve" value={issues} accent={issues > 0 ? 'text-amber-400' : 'text-emerald-400'} icon={ListChecks} onClick={() => onNavigate('action_plan')} />
      </div>

      {/* Good to know */}
      <section className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Lightbulb size={14} className="text-amber-400" /> Good to know for {countryName(country)}
        </p>
        <ul className="space-y-2">
          {tips.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
              <Lightbulb size={13} className="flex-shrink-0 mt-0.5 text-amber-400/70" />
              {t}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
