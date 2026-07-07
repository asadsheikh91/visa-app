import type { LucideIcon } from 'lucide-react'
import { Globe, Zap, Timer, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'

type Accent = 'orange' | 'blue' | 'violet'

const stats: { icon: LucideIcon; value: string; label: string; accent: Accent }[] = [
  { icon: Globe,       value: '50+',   label: 'Countries Covered',      accent: 'blue'   },
  { icon: Zap,         value: '4',     label: 'Major Country Engines',   accent: 'orange' },
  { icon: Timer,       value: '2 MIN', label: 'Average Result Time',     accent: 'orange' },
  { icon: ShieldCheck, value: '100%',  label: 'Gov-Sourced Rules',       accent: 'violet' },
]

export function StatsStrip() {
  return (
    <section id="stats" aria-label="ParchiVisa by the numbers" className="relative z-20 px-5 sm:px-8 lg:px-20">
      <div className="relative mx-auto max-w-[1180px] lg:-mt-12">
        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-10 -bottom-6 top-6 rounded-full bg-[radial-gradient(ellipse_at_30%_50%,rgba(255,90,31,0.15),transparent_60%),radial-gradient(ellipse_at_75%_50%,rgba(255,90,31,0.12),transparent_60%)] blur-2xl"
        />

        <div className="glass-strong relative grid grid-cols-2 overflow-hidden rounded-[24px] border-line-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] md:grid-cols-4">
          {stats.map((stat, i) => (
            <StatCell key={stat.label} {...stat} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function StatCell({
  icon: Icon,
  value,
  label,
  accent,
  index,
}: {
  icon: LucideIcon
  value: string
  label: string
  accent: Accent
  index: number
}) {
  const glow =
    accent === 'orange' ? 'bg-accent-orange/25' :
    accent === 'blue'   ? 'bg-sky-500/25' :
                          'bg-violet-500/25'
  const text =
    accent === 'orange' ? 'text-[#ff5a1f]' :
    accent === 'blue'   ? 'text-sky-400' :
                          'text-violet-400'

  return (
    <div
      className={clsx(
        'group px-4 py-8 transition-colors duration-300 hover:bg-white/[0.03] sm:px-6',
        'border-line-1',
        index % 2 === 1 && 'border-l',
        index >= 2 && 'border-t md:border-t-0',
        index !== 0 && 'md:border-l'
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center transition-transform duration-300 ease-out group-hover:-translate-y-1">
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-line-2 bg-tint-2">
          <span className={clsx('absolute inset-0 rounded-full opacity-70 blur-md transition-opacity duration-300 group-hover:opacity-100', glow)} aria-hidden />
          <Icon size={20} className={clsx('relative', text)} aria-hidden />
        </span>
        <span className="font-display text-3xl leading-none tracking-tight text-white sm:text-4xl">{value}</span>
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400 sm:text-[13px]">{label}</span>
      </div>
    </div>
  )
}
