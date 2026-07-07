'use client'

import Link from 'next/link'
import {
  Compass,
  GraduationCap,
  CalendarDays,
  FileCheck2,
  Wallet,
  Globe,
  ArrowRight,
  Pencil,
  AlertTriangle,
} from 'lucide-react'
import type { UserProfile } from '@/types/visa'
import {
  countryName,
  countryFlag,
  STUDY_LEVEL_LABELS,
  ADMISSION_LABELS,
  FUNDING_LABELS,
  SPONSOR_LABELS,
  humanize,
} from '@/lib/dashboardDisplay'

interface Props {
  profile: UserProfile
  hasCheck: boolean
  /** Smooth-scroll to the Visa File Builder section. */
  onContinue?: () => void
}

// ── Small presentational helpers ─────────────────────────────────────────────

function PlanFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Compass
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={14} className="text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">{label}</p>
        <p className="text-sm text-white font-medium truncate">{value}</p>
      </div>
    </div>
  )
}

// ── Active state computation ─────────────────────────────────────────────────

type PlanState = 'incomplete_profile' | 'no_check' | 'has_check'

function planState(profile: UserProfile, hasCheck: boolean): PlanState {
  if (!profile.onboarding_completed || !profile.primary_country) return 'incomplete_profile'
  if (!hasCheck) return 'no_check'
  return 'has_check'
}

// ── Component ────────────────────────────────────────────────────────────────

export function ActiveVisaPlan({ profile, hasCheck, onContinue }: Props) {
  const state = planState(profile, hasCheck)

  const others = (profile.interested_countries || []).filter(
    c => c !== profile.primary_country
  )

  // Primary action varies by state (the spec's three messages).
  const cta = (() => {
    if (state === 'incomplete_profile') {
      return {
        label: 'Complete your visa profile',
        href: '/onboarding' as const,
        onClick: undefined,
        icon: AlertTriangle,
      }
    }
    if (state === 'no_check') {
      return {
        label: 'Start your readiness check',
        href: (profile.primary_country
          ? `/tools/student-visa/countries/${profile.primary_country}`
          : '/tools/student-visa/countries') as string,
        onClick: undefined,
        icon: ArrowRight,
      }
    }
    return {
      label: 'Continue building your visa file',
      href: undefined,
      onClick: onContinue,
      icon: ArrowRight,
    }
  })()

  return (
    <section className="glass rounded-2xl border border-white/10 overflow-hidden">
      {/* Header band */}
      <div className="bg-gradient-to-br from-brand-900/40 to-accent-900/20 px-5 sm:px-6 py-5 border-b border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl leading-none flex-shrink-0">
              {countryFlag(profile.primary_country)}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-brand-300 font-semibold mb-0.5">
                Active visa plan
              </p>
              <h2 className="text-lg sm:text-xl font-bold text-white truncate">
                {profile.primary_country
                  ? `${countryName(profile.primary_country)} — Student Visa`
                  : 'Your student visa journey'}
              </h2>
              {others.length > 0 && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Also considering: {others.map(countryName).join(', ')}
                </p>
              )}
            </div>
          </div>
          <Link
            href="/onboarding"
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-all"
          >
            <Pencil size={12} />
            <span className="hidden sm:inline">Edit</span>
          </Link>
        </div>
      </div>

      {/* Facts grid */}
      <div className="px-5 sm:px-6 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {profile.study_level && (
            <PlanFact
              icon={GraduationCap}
              label="Study level"
              value={STUDY_LEVEL_LABELS[profile.study_level] ?? humanize(profile.study_level)}
            />
          )}
          {profile.intended_intake && (
            <PlanFact
              icon={CalendarDays}
              label="Intended intake"
              value={humanize(profile.intended_intake)}
            />
          )}
          {profile.admission_status && (
            <PlanFact
              icon={FileCheck2}
              label="Admission status"
              value={ADMISSION_LABELS[profile.admission_status] ?? humanize(profile.admission_status)}
            />
          )}
          {profile.funding_source && (
            <PlanFact
              icon={Wallet}
              label="Funding"
              value={
                profile.sponsor_relationship && SPONSOR_LABELS[profile.sponsor_relationship]
                  ? SPONSOR_LABELS[profile.sponsor_relationship]
                  : FUNDING_LABELS[profile.funding_source] ?? humanize(profile.funding_source)
              }
            />
          )}
          {profile.nationality && (
            <PlanFact icon={Globe} label="Nationality" value={humanize(profile.nationality)} />
          )}
          {profile.applying_from_country && (
            <PlanFact
              icon={Compass}
              label="Applying from"
              value={humanize(profile.applying_from_country)}
            />
          )}
        </div>

        {/* Risk-factor chips */}
        {(profile.previous_refusal === 'yes' ||
          profile.study_gap === 'yes' ||
          profile.dependants === 'yes') && (
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-white/10">
            {profile.previous_refusal === 'yes' && (
              <span className="text-xs px-2.5 py-1 rounded-full border border-orange-500/25 bg-orange-500/10 text-orange-300">
                Previous refusal
              </span>
            )}
            {profile.study_gap === 'yes' && (
              <span className="text-xs px-2.5 py-1 rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-300">
                Study gap
              </span>
            )}
            {profile.dependants === 'yes' && (
              <span className="text-xs px-2.5 py-1 rounded-full border border-white/15 bg-white/5 text-slate-300">
                Bringing dependants
              </span>
            )}
          </div>
        )}

        {/* State-driven primary action */}
        <div className="mt-5">
          {cta.href ? (
            <Link href={cta.href} className="btn-primary text-sm w-full sm:w-auto justify-center">
              <cta.icon size={14} />
              {cta.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={cta.onClick}
              className="btn-primary text-sm w-full sm:w-auto justify-center"
            >
              <cta.icon size={14} />
              {cta.label}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
