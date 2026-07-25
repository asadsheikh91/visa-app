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
import { countryName, countryFlag } from '@/lib/dashboardDisplay'
import { toneFromScore, toneTextClass } from '@/components/ui/StatusPill'

interface Props {
  latestCheck: HistoryItem | null
  file:        VisaFile | null
  loading:     boolean
  onNavigate:  (section: string) => void
}

function scoreColor(score: number): string {
  return toneTextClass(toneFromScore(score))
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
      className="group rounded-[4px] border border-hairline bg-white p-4 text-left transition-colors hover:border-support sm:p-5"
    >
      <div className="mb-2 flex items-center justify-between">
        <Icon size={16} className={accent} />
        <ArrowRight size={13} className="text-support transition-colors group-hover:text-ink" />
      </div>
      <p className={`font-mono text-[28px] font-bold leading-none tabular-nums ${accent}`}>
        {value}<span className="font-mono text-sm font-medium text-support">{suffix}</span>
      </p>
      <p className="mt-1.5 font-mono text-[10px] uppercase leading-tight tracking-[0.1em] text-support">{label}</p>
    </button>
  )
}

export function KpiOverview({ latestCheck, file, loading, onNavigate }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-28 animate-pulse rounded-[4px] border border-hairline bg-white" />
        ))}
      </div>
    )
  }

  // ── No readiness check yet → focused empty state ─────────────────────────────
  if (!latestCheck) {
    return (
      <section className="rounded-[4px] border border-hairline bg-white p-8 text-center shadow-[6px_6px_0_0] shadow-ink/10">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[4px] border border-hairline bg-paper">
          <ClipboardCheck size={22} className="text-stamp" />
        </div>
        <p className="mb-1 font-serif text-[19px] leading-tight text-ink">Start your visa journey</p>
        <p className="mx-auto mb-5 max-w-sm font-body text-sm text-support">
          Run the Student Visa Readiness Checker to unlock your score, action plan, and visa file.
        </p>
        <Link href="/tools/student-visa/countries" className="btn-primary text-sm">
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
      <div className="flex items-center gap-2 font-body text-sm text-support">
        <span>{countryFlag(country)}</span>
        <span className="font-medium text-ink">{countryName(country)}</span>
        <span className="text-hairline">·</span>
        <span>{latestCheck.result}</span>
      </div>

      {/* Next best action hint */}
      <div className="flex items-start gap-3 rounded-[4px] border-l-2 border-l-stamp border-y border-r border-y-hairline border-r-hairline bg-white p-4 sm:p-5">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[4px] border border-hairline bg-paper">
          <Sparkles size={16} className="text-stamp" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-stamp">Next best step</p>
          <p className="mt-0.5 font-body text-sm text-ink">{hint.text}</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(hint.section)}
          className="btn-primary flex-shrink-0 self-center px-3.5 py-2 text-xs"
        >
          {hint.cta} <ArrowRight size={13} />
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Readiness score" value={score} suffix=" / 100" accent={scoreColor(score)} icon={Gauge} onClick={() => onNavigate('readiness')} />
        <KpiTile label="Visa file complete" value={completion} suffix="%" accent={completion >= 100 ? 'text-stamp' : 'text-ink'} icon={FolderCheck} onClick={() => onNavigate('visa_file')} />
        <KpiTile label="Critical items left" value={criticalMissing} accent={criticalMissing > 0 ? 'text-seal-text' : 'text-stamp'} icon={AlertTriangle} onClick={() => onNavigate('visa_file')} />
        <KpiTile label="Issues to resolve" value={issues} accent={issues > 0 ? 'text-seal-text' : 'text-stamp'} icon={ListChecks} onClick={() => onNavigate('action_plan')} />
      </div>

      {/* Good to know */}
      <section className="rounded-[4px] border border-hairline bg-white p-5 shadow-[6px_6px_0_0] shadow-ink/10 sm:p-6">
        <p className="mb-3 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
          <Lightbulb size={14} className="text-stamp" /> Good to know for {countryName(country)}
        </p>
        <ul className="space-y-2">
          {tips.map((t, i) => (
            <li key={i} className="flex items-start gap-2 font-body text-sm text-ink">
              <Lightbulb size={13} className="mt-0.5 flex-shrink-0 text-stamp" />
              {t}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
