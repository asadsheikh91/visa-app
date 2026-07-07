'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ShieldCheck } from 'lucide-react'

const CHECKER_HREF = '/tools/student-visa/countries'
const HOW_HREF = '#story'

const trust = [
  'Free readiness score',
  'Answer in 2 minutes',
  'Rules from official sources',
]

export function HeroSection() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative min-h-screen overflow-hidden px-5 pt-[100px] pb-16 sm:px-8 lg:px-20 flex items-center"
    >
      <HeroBackdrop />

      <div className="relative z-10 mx-auto w-full max-w-[1280px]">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-12">

          {/* Left — copy */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.05] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#ff7a3c]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff5a1f] shadow-[0_0_6px_rgba(255,90,31,0.9)]" />
              For students who can&apos;t afford a &lsquo;no&rsquo;
            </span>

            <h1
              id="hero-heading"
              className="mt-7 font-display text-[clamp(3.2rem,7.5vw,6rem)] uppercase leading-[0.9] tracking-tight text-white"
            >
              Don&apos;t get refused
              <br />
              over something{' '}
              <span className="text-[#ff5a1f]" style={{ textShadow: '0 0 60px rgba(255,90,31,0.45)' }}>
                fixable.
              </span>
            </h1>

            <p className="mt-7 max-w-md text-lg leading-relaxed text-slate-300">
              Most student visa refusals come down to a handful of avoidable
              mistakes — a statement dated wrong, a missing paper, a weak SOP.
              We find them before the embassy does, and show you exactly how to
              fix each one.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href={CHECKER_HREF} className="btn-primary-lg group">
                Check My Readiness — Free
                <ArrowRight size={20} className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link href={HOW_HREF} className="btn-secondary">
                Where do visas go wrong?
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
              {trust.map((t) => (
                <li key={t} className="flex items-center gap-2 text-sm text-slate-400">
                  <ShieldCheck size={14} className="text-[#ff5a1f]" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — animated score dial */}
          <div className="flex justify-center lg:justify-end">
            <ScoreDial />
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <a
        href="#stats"
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-1.5 text-slate-500 transition-colors hover:text-slate-300"
        aria-label="Scroll to explore"
      >
        <span className="animate-scroll-cue flex flex-col items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.25em]">Scroll</span>
          <svg width="14" height="20" viewBox="0 0 14 20" fill="none" aria-hidden>
            <rect x="1" y="1" width="12" height="18" rx="6" stroke="currentColor" strokeWidth="1.5" />
            <rect x="6" y="4" width="2" height="5" rx="1" fill="currentColor" />
          </svg>
        </span>
      </a>
    </section>
  )
}

function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_44%,rgba(255,90,31,0.18),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,rgba(255,90,31,0.08),transparent_45%)]" />
    </div>
  )
}

function ScoreDial() {
  const [score, setScore] = useState(0)

  useEffect(() => {
    const dur = 1900, delay = 250, target = 78
    const ease = (t: number) => 1 - Math.pow(1 - t, 4)
    let start: number | null = null
    let raf: number

    const timer = setTimeout(() => {
      const run = (ts: number) => {
        if (!start) start = ts
        const p = Math.min((ts - start) / dur, 1)
        setScore(Math.round(ease(p) * target))
        if (p < 1) raf = requestAnimationFrame(run)
      }
      raf = requestAnimationFrame(run)
    }, delay)

    return () => { clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [])

  return (
    <div className="w-full max-w-[360px]">
      <svg
        viewBox="0 0 460 540"
        className="w-full"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Sample readiness score dial showing 78%"
      >
        <defs>
          <radialGradient id="dialBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e1a16" />
            <stop offset="100%" stopColor="#0f0d0b" />
          </radialGradient>
          <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffb05a" />
            <stop offset="100%" stopColor="#ff5a1f" />
          </linearGradient>
          <linearGradient id="topAmber" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff5a1f" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffb05a" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ff5a1f" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Card body */}
        <rect x="10" y="10" width="440" height="520" rx="32" fill="url(#dialBg)" />
        <rect x="10" y="10" width="440" height="520" rx="32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

        {/* Amber accent strip at top of card */}
        <rect x="60" y="10" width="340" height="4" rx="2" fill="url(#topAmber)" />

        {/* Outer slowly-spinning dashed ring */}
        <circle
          cx="230" cy="218" r="150"
          fill="none"
          stroke="rgba(255,90,31,0.18)"
          strokeWidth="1"
          strokeDasharray="4 18"
          style={{ animation: 'pvSpin 75s linear infinite', transformBox: 'fill-box', transformOrigin: 'center' }}
        />

        {/* Arc track (background) */}
        <circle
          cx="230" cy="218" r="150"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="20"
          strokeLinecap="round"
          strokeDasharray="942.48"
          strokeDashoffset="207.35"
          transform="rotate(-230.4 230 218)"
        />

        {/* Animated filled arc */}
        <circle
          className="pv-arc"
          cx="230" cy="218" r="150"
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth="20"
          strokeLinecap="round"
          strokeDasharray="942.48"
          transform="rotate(-230.4 230 218)"
        />

        {/* Score number — count-up driven by React state */}
        <text
          x="230" y="192"
          textAnchor="middle"
          fontFamily="Anton, sans-serif"
          fontSize="92"
          fill="#fff"
        >
          {score}
        </text>

        {/* Label below score */}
        <text
          x="230" y="238"
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontSize="15"
          fill="rgba(255,255,255,0.45)"
          fontWeight="500"
          letterSpacing="3"
        >
          READINESS SCORE
        </text>

        {/* Status badge — dot + label as one centered unit */}
        <rect x="152" y="260" width="156" height="32" rx="16" fill="rgba(34,197,94,0.1)" stroke="rgba(34,197,94,0.28)" strokeWidth="1" />
        <circle cx="178" cy="276" r="4.5" fill="#22c55e" />
        <text x="192" y="280" textAnchor="start" fontFamily="Inter, sans-serif" fontSize="11" fill="#22c55e" fontWeight="600" letterSpacing="1.2">
          STRONG PROFILE
        </text>

        {/* Country chips — fade-up after arc completes */}
        {([
          { label: 'UK',  x: 100 },
          { label: 'USA', x: 187 },
          { label: 'CAN', x: 274 },
          { label: 'AUS', x: 361 },
        ] as const).map((c, i) => (
          <g
            key={c.label}
            style={{
              opacity: 0,
              animation: 'pvFadeUp .7s cubic-bezier(.22,1,.36,1) forwards',
              animationDelay: `${1.45 + i * 0.25}s`,
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          >
            <rect x={c.x - 30} y="358" width="60" height="28" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <text x={c.x} y="377" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="12" fill="rgba(255,255,255,0.7)" fontWeight="600">
              {c.label}
            </text>
          </g>
        ))}

        {/* HUD rail */}
        <rect x="36" y="412" width="388" height="92" rx="16" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <text x="62" y="436" fontFamily="Inter, sans-serif" fontSize="9.5" fill="rgba(255,255,255,0.32)" fontWeight="700" letterSpacing="2.5">PROFILE SIGNALS</text>

        {([
          { label: 'Finances',  pct: 90, y: 452 },
          { label: 'Language',  pct: 75, y: 466 },
          { label: 'Documents', pct: 60, y: 480 },
        ] as const).map((row) => (
          <g key={row.label}>
            <text x="62" y={row.y} fontFamily="Inter, sans-serif" fontSize="10" fill="rgba(255,255,255,0.45)">{row.label}</text>
            <rect x="148" y={row.y - 9} width="240" height="5" rx="2.5" fill="rgba(255,255,255,0.06)" />
            <rect x="148" y={row.y - 9} width={240 * row.pct / 100} height="5" rx="2.5" fill="url(#arcGrad)" />
          </g>
        ))}
      </svg>
    </div>
  )
}
