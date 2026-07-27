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
  Easy:   'bg-readiness-high/10 text-readiness-high border-readiness-high/40',
  Medium: 'bg-readiness-mid/10 text-readiness-mid border-readiness-mid/40',
  Hard:   'bg-readiness-low/10 text-readiness-low border-readiness-low/40',
}

// Document-system status pill — mono UPPERCASE, squared, per the "status value"
// slot. The readiness-* tokens now resolve to stamp / warn / fail on paper.
function DifficultyPill({ level }: { level: Difficulty }) {
  return (
    <span
      className={`inline-flex items-center rounded-[3px] border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${difficultyStyles[level]}`}
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
          <div className="overflow-hidden border border-ink bg-white shadow-[6px_6px_0_0] shadow-ink/10">
            {/* Header row: country names */}
            <div className={`${GRID} border-b border-ink`}>
              <div className="px-6 py-5" aria-hidden="true" />
              {COUNTRIES.map((c) => (
                <div key={c.slug} className="px-4 py-5 text-center">
                  <span className="text-2xl" aria-hidden="true">{c.flag}</span>
                  <p className="mt-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink">
                    {c.name}
                  </p>
                </div>
              ))}
            </div>

            {/* Metric rows */}
            {metrics.map((m) => {
              const Icon = m.icon
              return (
                <div
                  key={m.key}
                  className={`${GRID} border-b border-hairline last:border-b-0 odd:bg-paper-deep/40`}
                >
                  <div className="flex items-center gap-3 px-6 py-4">
                    <Icon size={16} className="flex-shrink-0 text-stamp" aria-hidden="true" />
                    <div>
                      <p className="font-body text-sm font-medium text-ink">{m.label}</p>
                      <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-support">
                        {m.sub}
                      </p>
                    </div>
                  </div>
                  {COUNTRIES.map((c) => (
                    <div
                      key={c.slug}
                      className="flex items-center justify-center px-4 py-4 text-center font-mono text-[13px] text-ink"
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
            <div key={c.slug} className="border border-ink bg-white p-5 shadow-[6px_6px_0_0] shadow-ink/10">
              <div className="flex items-center gap-2.5 border-b border-hairline pb-3">
                <span className="text-2xl" aria-hidden="true">{c.flag}</span>
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink">
                  {c.name}
                </p>
              </div>
              <dl className="mt-3 space-y-3">
                {metrics.map((m) => {
                  const Icon = m.icon
                  return (
                    <div key={m.key} className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-2 font-body text-[13px] text-support">
                        <Icon size={14} className="flex-shrink-0 text-stamp" aria-hidden="true" />
                        {m.label}
                      </dt>
                      <dd className="text-right font-mono text-[13px] font-medium text-ink">
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

        {/* "Caption" slot — mono UPPERCASE, wide tracking. */}
        <p className="measure mx-auto mt-8 text-center font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-support">
          Figures are approximate, for general comparison only — costs and timelines vary by
          institution, city and circumstance. Always verify with the official visa authority.
        </p>

        <CheckReadinessCta className="mt-10" />
      </div>
    </section>
  )
}
