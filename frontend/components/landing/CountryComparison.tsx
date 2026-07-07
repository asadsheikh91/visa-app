import type { LucideIcon } from 'lucide-react'
import { Banknote, Home, Briefcase, Route, Hourglass } from 'lucide-react'
import { COUNTRIES, type CountrySlug } from '@/lib/countries'
import { SectionHeader } from '@/components/ui/section-header'
import { CheckReadinessCta } from './CheckReadinessCta'

// ---------------------------------------------------------------------------
// Content keyed by slug — identity + order come from COUNTRIES.
// Figures are approximate, for orientation only.
// ---------------------------------------------------------------------------

type Difficulty = 'Easy' | 'Medium' | 'Hard'

interface Metrics {
  tuition: string
  living: string
  workHours: string
  prDifficulty: Difficulty
  processing: string
}

const data: Record<CountrySlug, Metrics> = {
  australia: { tuition: '$20k–$45k', living: 'Rs 140k–280k', workHours: '24 hrs', prDifficulty: 'Medium', processing: '4–8 weeks' },
  canada:    { tuition: '$15k–$35k', living: 'Rs 110k–220k', workHours: '24 hrs', prDifficulty: 'Easy',   processing: '8–12 weeks' },
  usa:       { tuition: '$25k–$55k', living: 'Rs 150k–300k', workHours: '20 hrs', prDifficulty: 'Hard',   processing: '3–5 weeks' },
  uk:        { tuition: '$22k–$40k', living: 'Rs 130k–260k', workHours: '20 hrs', prDifficulty: 'Medium', processing: '3 weeks' },
}

// Row metadata — drives both the desktop table rows and the mobile card rows.
// `key` indexes the string fields of Metrics; prDifficulty is rendered specially.
const metrics: { key: keyof Metrics; label: string; sub: string; icon: LucideIcon }[] = [
  { key: 'tuition',      label: 'Average tuition',     sub: 'USD / year',  icon: Banknote },
  { key: 'living',       label: 'Monthly living cost', sub: 'PKR / month', icon: Home },
  { key: 'workHours',    label: 'Work hours allowed',  sub: 'per week',    icon: Briefcase },
  { key: 'prDifficulty', label: 'PR pathway',          sub: 'difficulty',  icon: Route },
  { key: 'processing',   label: 'Visa processing',     sub: 'average time', icon: Hourglass },
]

// Same readiness language as the ScoreRing: high = ready, mid = borderline, low = high risk.
// Easy PR pathway = most ready, Hard = highest risk.
const difficultyStyles: Record<Difficulty, string> = {
  Easy:   'bg-readiness-high/10 text-readiness-high border-readiness-high/30',
  Medium: 'bg-readiness-mid/10 text-readiness-mid border-readiness-mid/30',
  Hard:   'bg-readiness-low/10 text-readiness-low border-readiness-low/30',
}

function DifficultyPill({ level }: { level: Difficulty }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${difficultyStyles[level]}`}
    >
      {level}
    </span>
  )
}

const GRID = 'grid grid-cols-[1.4fr_repeat(4,1fr)]'

// ---------------------------------------------------------------------------
// CountryComparison
// ---------------------------------------------------------------------------

export function CountryComparison() {
  return (
    <section className="relative z-10 px-4 py-10 sm:py-12" aria-labelledby="comparison-heading">
      <div className="container-inner">
        <SectionHeader
          eyebrow="Compare destinations"
          title="How the top study destinations stack up"
          subtitle="A quick side-by-side of cost, work rights, and visa timelines across the four countries we support."
          headingId="comparison-heading"
        />

        {/* ── Desktop: comparison table ─────────────────────────────────── */}
        <div className="hidden lg:block">
          <div className="glass overflow-hidden rounded-2xl">
            {/* Header row: country names */}
            <div className={`${GRID} border-b border-line-1`}>
              <div className="px-6 py-5" aria-hidden="true" />
              {COUNTRIES.map((c) => (
                <div key={c.slug} className="px-4 py-5 text-center">
                  <span className="text-2xl" aria-hidden="true">{c.flag}</span>
                  <p className="mt-1.5 text-sm font-semibold text-white">{c.name}</p>
                </div>
              ))}
            </div>

            {/* Metric rows */}
            {metrics.map((m) => {
              const Icon = m.icon
              return (
                <div
                  key={m.key}
                  className={`${GRID} border-b border-line-1 last:border-b-0 odd:bg-tint-1`}
                >
                  <div className="flex items-center gap-3 px-6 py-4">
                    <Icon size={16} className="flex-shrink-0 text-brand-300" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-white">{m.label}</p>
                      <p className="text-xs text-slate-500">{m.sub}</p>
                    </div>
                  </div>
                  {COUNTRIES.map((c) => (
                    <div
                      key={c.slug}
                      className="flex items-center justify-center px-4 py-4 text-center text-sm text-slate-300"
                    >
                      {m.key === 'prDifficulty'
                        ? <DifficultyPill level={data[c.slug].prDifficulty} />
                        : data[c.slug][m.key]}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Mobile / tablet: stacked country cards ────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
          {COUNTRIES.map((c) => (
            <div key={c.slug} className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2.5 border-b border-line-1 pb-3">
                <span className="text-2xl" aria-hidden="true">{c.flag}</span>
                <p className="text-base font-semibold text-white">{c.name}</p>
              </div>
              <dl className="mt-3 space-y-3">
                {metrics.map((m) => {
                  const Icon = m.icon
                  return (
                    <div key={m.key} className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-2 text-xs text-slate-400">
                        <Icon size={14} className="flex-shrink-0 text-brand-300" aria-hidden="true" />
                        {m.label}
                      </dt>
                      <dd className="text-right text-sm font-medium text-slate-200">
                        {m.key === 'prDifficulty'
                          ? <DifficultyPill level={data[c.slug].prDifficulty} />
                          : data[c.slug][m.key]}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-600">
          Figures are approximate and for general comparison only — actual costs and timelines vary by institution,
          city, and individual circumstances. Always verify with the official visa authority.
        </p>

        <CheckReadinessCta className="mt-10" />
      </div>
    </section>
  )
}
