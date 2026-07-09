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
      <HorizonBackdrop />

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

// ---------------------------------------------------------------------------
// Departure-horizon backdrop
//
// A rim-lit planet curve rises from the bottom of the section — the view from
// a night flight window. Above it: a quiet star field and one animated dashed
// flight path (departure west, arrival east) with a plane at its apex.
// Pure SVG + CSS; no client JS.
// ---------------------------------------------------------------------------

// Deterministic star field (seeded LCG) so the server and client render
// identical markup — no hydration mismatch, no Math.random().
function makeStars(count: number) {
  let seed = 20260704
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 20 + rand() * 1160,     // keep off the extreme edges
    y: 20 + rand() * 300,      // upper sky only — clear of the horizon
    r: 0.8 + rand() * 1.3,
    delay: `${(rand() * 4).toFixed(2)}s`,
    dur: `${(2.6 + rand() * 3).toFixed(2)}s`,
  }))
}

const STARS = makeStars(46)

function HorizonBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      {/* Deep-night base */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#0a0908_0%,#0d0a08_55%,#140d08_100%)]" />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 640"
        preserveAspectRatio="xMidYMax slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Rim light along the planet's edge — bright at the top, fading at the sides */}
          <linearGradient id="pvHorizonRim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#ff5a1f" stopOpacity="0" />
            <stop offset="35%" stopColor="#ff5a1f" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#ffb05a" stopOpacity="1" />
            <stop offset="65%" stopColor="#ff5a1f" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ff5a1f" stopOpacity="0" />
          </linearGradient>
          {/* Atmosphere glow hugging the rim */}
          <radialGradient id="pvAtmosphere" cx="50%" cy="100%" r="65%">
            <stop offset="55%" stopColor="#ff5a1f" stopOpacity="0" />
            <stop offset="78%" stopColor="#ff5a1f" stopOpacity="0.16" />
            <stop offset="88%" stopColor="#ffb05a" stopOpacity="0.30" />
            <stop offset="94%" stopColor="#ff5a1f" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ff5a1f" stopOpacity="0" />
          </radialGradient>
          {/* Planet surface: dark, lit faintly from the rim down */}
          <linearGradient id="pvPlanet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c120a" />
            <stop offset="40%" stopColor="#120c07" />
            <stop offset="100%" stopColor="#0a0806" />
          </linearGradient>
          <clipPath id="pvPlanetClip">
            <circle cx="600" cy="1560" r="1000" />
          </clipPath>
        </defs>

        {/* Star field — slow, staggered twinkle */}
        <g>
          {STARS.map((s) => (
            <circle
              key={s.id}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#ffd9c2"
              className="pv-twinkle"
              style={{ animationDelay: s.delay, animationDuration: s.dur }}
            />
          ))}
        </g>

        {/* Flight path — Pakistan (west dot) to destination (east dot) */}
        <g>
          <path
            d="M150 470 Q 600 210 1050 440"
            stroke="#ff5a1f"
            strokeOpacity="0.55"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="3 11"
            className="animate-dash-flow"
          />
          {/* Departure — home */}
          <circle cx="150" cy="470" r="4.5" fill="#0e7a3d" />
          <circle cx="150" cy="470" r="9" fill="none" stroke="#0e7a3d" strokeOpacity="0.45" strokeWidth="1.2" className="pv-twinkle" />
          {/* Arrival — destination, warm pulse */}
          <circle cx="1050" cy="440" r="4.5" fill="#ffb05a" />
          <circle cx="1050" cy="440" r="10" fill="none" stroke="#ffb05a" strokeOpacity="0.5" strokeWidth="1.2" className="pv-twinkle" />

          {/* Plane at the apex, nose toward arrival */}
          <g transform="translate(620, 322) rotate(12)">
            <path d="M0-11 L5.5 5 L0 2 L-5.5 5 Z" fill="#ff5a1f" />
            <path d="M-10 1 L10 1" stroke="#ff5a1f" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M-5.5 6.5 L5.5 6.5" stroke="#ffb05a" strokeWidth="1.2" strokeLinecap="round" />
            {/* Contrail */}
            <path d="M-14 3 L-38 14" stroke="#ff5a1f" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />
          </g>
        </g>

        {/* Atmosphere glow (sits behind the rim line) */}
        <circle cx="600" cy="1560" r="1080" fill="url(#pvAtmosphere)" />

        {/* Planet body */}
        <circle cx="600" cy="1560" r="1000" fill="url(#pvPlanet)" />

        {/* Faint surface texture: meridian hints clipped to the planet */}
        <g clipPath="url(#pvPlanetClip)" stroke="#ff5a1f" strokeOpacity="0.07">
          <circle cx="240" cy="1560" r="1000" fill="none" strokeWidth="1" />
          <circle cx="960" cy="1560" r="1000" fill="none" strokeWidth="1" />
          <circle cx="600" cy="1720" r="1000" fill="none" strokeWidth="1" />
        </g>

        {/* City lights on the surface, just under the rim */}
        <g clipPath="url(#pvPlanetClip)">
          {[
            { x: 380, y: 590, r: 1.6 }, { x: 452, y: 606, r: 1.2 }, { x: 540, y: 578, r: 1.8 },
            { x: 648, y: 585, r: 1.3 }, { x: 730, y: 600, r: 1.7 }, { x: 816, y: 622, r: 1.2 },
            { x: 590, y: 618, r: 1.1 }, { x: 470, y: 640, r: 1.4 },
          ].map((c, i) => (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={c.r}
              fill="#ffb05a"
              className="pv-twinkle"
              style={{ animationDelay: `${(i * 0.7) % 4}s`, animationDuration: '3.4s' }}
            />
          ))}
        </g>

        {/* Rim light — drawn last so it sits crisp on the edge */}
        <circle
          cx="600"
          cy="1560"
          r="1000"
          fill="none"
          stroke="url(#pvHorizonRim)"
          strokeWidth="2.5"
        />
      </svg>

      {/* Soft glow lifting off the horizon into the content area */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,90,31,0.22),transparent_65%)]" />
    </div>
  )
}
