import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import Link from 'next/link'

type Accent = 'orange' | 'violet'

const features: { icon: ReactNode; title: string; text: string; accent: Accent }[] = [
  {
    icon: <RuleEngineIcon />,
    title: 'Rule Engine',
    text: "Our deterministic scoring engine reads immigration rules so you don't need to. No AI guessing.",
    accent: 'orange',
  },
  {
    icon: <ProfileIcon />,
    title: 'Profile Matching',
    text: 'Not one-size-fits-all. Every answer is weighed against your unique profile.',
    accent: 'violet',
  },
  {
    icon: <RealtimeIcon />,
    title: 'Real-Time Data',
    text: 'Gov-sourced rules, updated daily. Visa policies change — we track them so you stay ahead.',
    accent: 'orange',
  },
  {
    icon: <ActionPlanIcon />,
    title: 'Action Plan',
    text: "We don't leave you hanging. Get a custom action plan and next steps after your results.",
    accent: 'violet',
  },
]

const CHECKER_HREF = '/tools/student-visa/countries'

export function FeatureSection() {
  return (
    <section id="features" aria-labelledby="features-heading" className="relative px-5 py-24 sm:px-8 lg:px-20 lg:py-28">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <FeatureIntro />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureIntro() {
  return (
    <div className="max-w-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#ffb05a]">
        Why you can trust the verdict
      </p>

      <h2
        id="features-heading"
        className="mt-5 font-display text-[clamp(2.25rem,4.6vw,3.5rem)] uppercase leading-[0.95] tracking-tight text-white"
      >
        Not an agent&apos;s
        <br />
        guess. A <span className="text-[#ff5a1f]" style={{ textShadow: '0 0 34px rgba(255,90,31,0.4)' }}>verdict.</span>
      </h2>

      <p className="mt-6 text-base leading-relaxed text-slate-300 sm:text-lg">
        Anyone can tell you &ldquo;you&apos;ll be fine.&rdquo; We read the actual immigration rules,
        the exceptions, and your real profile — and show you the working behind every answer, so you
        never have to take our word for it.
      </p>

      <LiveRuleEngine />

      <Link
        href={CHECKER_HREF}
        className="group mt-8 inline-flex items-center gap-3 text-sm font-semibold text-white transition-colors hover:text-[#ff7a3c]"
      >
        Start your check now
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ff5a1f]/40 bg-[#ff5a1f]/10 transition-all duration-200 group-hover:bg-[#ff5a1f]/20 group-hover:border-[#ff5a1f]/60">
          <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </Link>
    </div>
  )
}

function LiveRuleEngine() {
  return (
    <div className="relative mt-16 max-w-sm">
      {/* Dotted wave — sits fully above the pill so it reads as a crisp flourish */}
      <svg
        className="pointer-events-none absolute right-2 -top-12 h-11 w-56 opacity-80"
        viewBox="0 0 260 90"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0 60 C 30 20, 55 20, 80 50 S 130 80, 160 45 S 215 10, 260 40"
          stroke="#ff5a1f"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1 9"
        />
        <path
          d="M0 72 C 35 40, 60 44, 90 64 S 140 88, 175 60 S 220 34, 260 58"
          stroke="#ffb05a"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="1 11"
          opacity="0.5"
        />
      </svg>

      <div className="glass-strong relative z-10 flex items-center justify-between gap-4 rounded-full border-line-2 px-5 py-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-readiness-high opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-readiness-high shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
          </span>
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-white">
            Live Rule Engine
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          Updated 2 min ago
        </span>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  text,
  accent,
}: {
  icon: ReactNode
  title: string
  text: string
  accent: Accent
}) {
  const glow = accent === 'orange' ? 'bg-[#ff5a1f]/20' : 'bg-violet-500/20'
  const hoverGlow =
    accent === 'orange'
      ? 'hover:shadow-[inset_0_0_46px_rgba(255,90,31,0.1),0_24px_60px_-24px_rgba(0,0,0,0.7)]'
      : 'hover:shadow-[inset_0_0_46px_rgba(124,58,237,0.1),0_24px_60px_-24px_rgba(0,0,0,0.7)]'

  return (
    <article
      className={clsx(
        'group relative flex flex-col rounded-2xl border border-line-1 bg-tint-2 p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-line-3',
        hoverGlow
      )}
    >
      <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-line-2 bg-tint-2">
        <span className={clsx('absolute inset-0 rounded-2xl opacity-60 blur-md transition-opacity duration-300 group-hover:opacity-100', glow)} aria-hidden />
        <span className="relative">{icon}</span>
      </span>

      <h3 className="mt-5 text-base font-bold uppercase leading-snug tracking-wide text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
    </article>
  )
}

/* ── Inline SVG icons from HTML design ──────────────────────────────────── */

function RuleEngineIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="3" width="20" height="18" rx="3" stroke="#ff5a1f" strokeWidth="1.5" />
      <path d="M7 8h10M7 12h6M7 16h8" stroke="#ff5a1f" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="18" cy="15" r="3" fill="rgba(255,90,31,0.18)" stroke="#ff5a1f" strokeWidth="1.2" />
      <path d="M17.2 15.4l.6.6 1.2-1.2" stroke="#ff5a1f" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="7" r="4" stroke="#a78bfa" strokeWidth="1.5" />
      <path d="M2 21c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 11l2 2 4-4" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RealtimeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="#ff5a1f" strokeWidth="1.5" />
      <path d="M12 6v6l4 2" stroke="#ff5a1f" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 12h2M20 12h2M12 2v2M12 20v2" stroke="#ff5a1f" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function ActionPlanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 11l3 3 8-8" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
