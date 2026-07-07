import Link from 'next/link'
import { ArrowRight, BellOff, Lock, ShieldCheck } from 'lucide-react'

const CHECKER_HREF = '/tools/student-visa/countries'

const trust = [
  { icon: Lock,        label: '100% Secure' },
  { icon: BellOff,     label: 'No Spam, Ever' },
  { icon: ShieldCheck, label: 'Private & Safe' },
]

export function FinalCTA() {
  return (
    <section
      id="cta"
      aria-labelledby="cta-heading"
      className="relative overflow-hidden px-5 py-24 sm:px-8 lg:px-20 lg:py-32"
    >
      <EarthBackdrop />

      <div className="relative z-10 mx-auto flex max-w-[1280px] flex-col items-center gap-10 text-center lg:flex-row lg:items-center lg:justify-between lg:text-left">
        <div className="max-w-2xl">
          <h2
            id="cta-heading"
            className="font-display text-[clamp(2.5rem,5.5vw,4.5rem)] uppercase leading-[0.92] tracking-tight text-white [text-shadow:0_2px_40px_rgba(0,0,0,0.6)]"
          >
            Your journey
            <br />
            deserves{' '}
            <span className="text-[#ff5a1f] [text-shadow:0_0_40px_rgba(255,90,31,0.5)]">clarity.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg text-slate-300 lg:mx-0">
            Stop guessing. Get real answers in less than 2 minutes.
          </p>
        </div>

        <div className="flex w-full flex-col items-stretch gap-6 lg:w-auto lg:items-end">
          <Link
            href={CHECKER_HREF}
            className="group btn-orange-lg w-full justify-center px-9 py-5 text-lg uppercase tracking-wide shadow-[0_0_0_1px_rgba(255,90,31,0.5),0_20px_50px_-10px_rgba(255,90,31,0.7)] sm:w-auto"
          >
            Check Your Eligibility
            <ArrowRight size={20} className="transition-transform duration-200 group-hover:translate-x-1" />
          </Link>

          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-end">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-slate-400">
                <Icon size={15} className="text-[#ff5a1f]" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function EarthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      {/* Warm base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgba(255,90,31,0.22),transparent_55%),linear-gradient(180deg,#0a0908_0%,#0f0b08_60%,#130d08_100%)]" />

      {/* Earth / globe SVG */}
      <svg
        className="absolute left-1/2 top-1/2 h-[90%] w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.12]"
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Globe outline */}
        <circle cx="250" cy="250" r="220" stroke="#ff5a1f" strokeWidth="1.5" />

        {/* Latitude lines */}
        {[0.28, 0.44, 0.56, 0.72].map((t, i) => {
          const y = 250 - 220 + t * 440
          const half = Math.sqrt(220 * 220 - (y - 250) * (y - 250))
          return <ellipse key={i} cx="250" cy={y} rx={half} ry={half * 0.28} stroke="#ff5a1f" strokeWidth="0.8" />
        })}
        {/* Equator */}
        <ellipse cx="250" cy="250" rx="220" ry="62" stroke="#ff5a1f" strokeWidth="1.2" />

        {/* Longitude lines */}
        {[0, 30, 60, 90, 120, 150].map((deg) => (
          <ellipse key={deg} cx="250" cy="250" rx={Math.cos((deg * Math.PI) / 180) * 220} ry="220" stroke="#ff5a1f" strokeWidth="0.8" />
        ))}

        {/* Flight path arc across the globe */}
        <path
          d="M80 320 Q250 60 420 300"
          stroke="#ff5a1f"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="2 9"
        />

        {/* Departure dot */}
        <circle cx="82" cy="318" r="5" fill="#ff5a1f" />
        {/* Arrival dot */}
        <circle cx="418" cy="298" r="5" fill="#ffb05a" />

        {/* Plane icon at midpoint */}
        <g transform="translate(250, 144) rotate(25)">
          <path d="M0-10 L5 5 L0 2 L-5 5Z" fill="#ff5a1f" />
          <path d="M-9 1 L9 1" stroke="#ff5a1f" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M-5 6 L5 6" stroke="#ffb05a" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </svg>

      {/* Orange light horizon glow */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent,rgba(255,90,31,0.28))] blur-xl" />
    </div>
  )
}
