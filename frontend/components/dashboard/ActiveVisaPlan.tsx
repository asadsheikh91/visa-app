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
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[4px] border border-hairline bg-paper">
        <Icon size={14} className="text-stamp" />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-support">{label}</p>
        <p className="truncate font-body text-sm font-medium text-ink">{value}</p>
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
    <section className="overflow-hidden rounded-[4px] border border-hairline bg-white shadow-[6px_6px_0_0] shadow-ink/10">
      {/* Header band */}
      <div className="border-b border-hairline bg-paper-deep px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex-shrink-0 text-3xl leading-none">
              {countryFlag(profile.primary_country)}
            </span>
            <div className="min-w-0">
              <p className="mb-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-stamp">
                Active visa plan
              </p>
              <h2 className="truncate font-serif text-[19px] leading-tight text-ink sm:text-[22px]">
                {profile.primary_country
                  ? `${countryName(profile.primary_country)} — Student Visa`
                  : 'Your student visa journey'}
              </h2>
              {others.length > 0 && (
                <p className="mt-0.5 truncate font-body text-xs text-support">
                  Also considering: {others.map(countryName).join(', ')}
                </p>
              )}
            </div>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-[3px] px-2.5 py-1.5 font-body text-xs text-support transition-colors hover:bg-white hover:text-ink"
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
          <div className="mt-5 flex flex-wrap gap-2 border-t border-hairline pt-4">
            {profile.previous_refusal === 'yes' && (
              <span className="rounded-[3px] border border-seal-text/50 px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-seal-text">
                Previous refusal
              </span>
            )}
            {profile.study_gap === 'yes' && (
              <span className="rounded-[3px] border border-seal-text/40 px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-seal-text">
                Study gap
              </span>
            )}
            {profile.dependants === 'yes' && (
              <span className="rounded-[3px] border border-hairline px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-support">
                Bringing dependants
              </span>
            )}
          </div>
        )}

        {/* State-driven primary action */}
        <div className="mt-5">
          {cta.href ? (
            <Link href={cta.href} className="btn-primary w-full text-sm sm:w-auto">
              <cta.icon size={14} />
              {cta.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={cta.onClick}
              className="btn-primary w-full text-sm sm:w-auto"
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
