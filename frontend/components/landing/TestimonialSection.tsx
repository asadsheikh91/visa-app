import { BadgeCheck, Quote } from 'lucide-react'

export function TestimonialSection() {
  return (
    <section
      id="testimonial"
      aria-label="What travelers say"
      className="relative px-5 py-24 sm:px-8 lg:px-20 lg:py-28"
    >
      <div className="relative mx-auto max-w-[1280px]">
        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-10 -bottom-8 top-10 rounded-full bg-[radial-gradient(ellipse_at_70%_60%,rgba(255,90,31,0.14),transparent_60%)] blur-2xl"
        />

        <div className="group glass-strong relative grid grid-cols-1 overflow-hidden rounded-[28px] border-line-2 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.85)] lg:grid-cols-[0.82fr_1fr]">
          {/* Hover sheen */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/4 z-30 w-1/3 -translate-x-[180%] -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-[420%]"
          />
          <PassportPanel />
          <QuotePanel />
        </div>
      </div>
    </section>
  )
}

function PassportPanel() {
  return (
    <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden bg-[linear-gradient(155deg,#1a1410_0%,#0f0c09_60%,#0a0806_100%)] lg:min-h-full lg:[clip-path:polygon(0_0,100%_0,90%_100%,0_100%)]">
      {/* Warm ambient glow */}
      <span className="absolute left-[30%] top-[30%] h-48 w-48 rounded-full bg-[#ff5a1f]/10 blur-[60px]" aria-hidden />

      {/* Passport / document illustration */}
      <svg
        viewBox="0 0 320 380"
        className="relative z-10 w-[62%] max-w-[220px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {/* Passport body */}
        <rect x="30" y="20" width="260" height="340" rx="14" fill="#1c1510" stroke="rgba(255,90,31,0.35)" strokeWidth="1.5" />
        <rect x="30" y="20" width="260" height="340" rx="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

        {/* Spine */}
        <rect x="30" y="20" width="28" height="340" rx="14" fill="rgba(255,90,31,0.15)" />
        <line x1="58" y1="20" x2="58" y2="360" stroke="rgba(255,90,31,0.25)" strokeWidth="1" />

        {/* Photo box */}
        <rect x="80" y="55" width="90" height="110" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        <circle cx="125" cy="92" r="22" fill="rgba(255,90,31,0.18)" stroke="rgba(255,90,31,0.3)" strokeWidth="1" />
        <path d="M102 148 Q125 122 148 148" stroke="rgba(255,90,31,0.3)" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Name lines */}
        <rect x="80" y="182" width="130" height="8" rx="4" fill="rgba(255,255,255,0.15)" />
        <rect x="80" y="198" width="90" height="6" rx="3" fill="rgba(255,255,255,0.08)" />

        {/* MRZ lines at bottom */}
        <rect x="58" y="298" width="230" height="6" rx="3" fill="rgba(255,255,255,0.07)" />
        <rect x="58" y="312" width="230" height="6" rx="3" fill="rgba(255,255,255,0.07)" />
        <rect x="58" y="326" width="180" height="6" rx="3" fill="rgba(255,255,255,0.05)" />

        {/* Approval stamp — rotated */}
        <g transform="translate(165, 205) rotate(-18)">
          <circle cx="0" cy="0" r="48" fill="none" stroke="rgba(34,197,94,0.55)" strokeWidth="2" strokeDasharray="6 4" />
          <circle cx="0" cy="0" r="40" fill="rgba(34,197,94,0.08)" stroke="rgba(34,197,94,0.35)" strokeWidth="1.5" />
          <text y="-10" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9" fill="rgba(34,197,94,0.9)" fontWeight="700" letterSpacing="1.5">VISA</text>
          <text y="4" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9" fill="rgba(34,197,94,0.9)" fontWeight="700" letterSpacing="1.5">APPROVED</text>
          <path d="M-12 14 l8 8 16-18" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>

        {/* Country flag hint */}
        <rect x="80" y="222" width="20" height="14" rx="2" fill="#ff5a1f" opacity="0.7" />
        <rect x="100" y="222" width="20" height="14" rx="2" fill="rgba(255,255,255,0.18)" />
        <rect x="120" y="222" width="20" height="14" rx="2" fill="#ff5a1f" opacity="0.5" />
      </svg>

      {/* Vertical pagination */}
      <div className="absolute left-5 top-6 bottom-6 hidden flex-col items-center justify-between lg:flex">
        <span className="font-mono text-sm font-bold text-white">01</span>
        <div className="flex flex-col items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff5a1f] shadow-[0_0_6px_rgba(255,90,31,0.9)]" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
        </div>
        <span className="font-mono text-[11px] tracking-widest text-slate-400">1/06</span>
      </div>
    </div>
  )
}

function QuotePanel() {
  return (
    <div className="relative flex flex-col justify-center p-8 sm:p-12 lg:p-14">
      <RealResultsSeal />

      <Quote size={52} className="text-[#ff5a1f] [text-shadow:0_0_30px_rgba(255,90,31,0.4)]" fill="currentColor" aria-hidden />

      <blockquote className="mt-5 max-w-lg text-balance text-2xl font-extrabold leading-[1.2] text-white sm:text-[2rem]">
        I checked 5 websites. Only{' '}
        <span className="text-[#ff5a1f]">ParchiVisa</span> made sense.
      </blockquote>

      <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-300">
        Every other site gave me generic info. ParchiVisa showed me exactly what applies to me, what I
        should fix, and what are my real chances.
      </p>

      <figcaption className="mt-8 flex items-center gap-3">
        <span className="h-11 w-11 rounded-full bg-gradient-to-br from-[#ffb05a] to-[#ff5a1f] shadow-md" aria-hidden />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white">Arjun S.</span>
            <BadgeCheck size={16} className="text-[#ff5a1f]" aria-hidden />
          </div>
          <p className="text-sm text-slate-400">Canada Visitor Visa</p>
        </div>
      </figcaption>
    </div>
  )
}

function RealResultsSeal() {
  return (
    <div className="absolute right-6 top-6 hidden h-24 w-24 sm:block" aria-hidden>
      <svg viewBox="0 0 120 120" className="h-full w-full animate-[spin_22s_linear_infinite]">
        <defs>
          <path id="sealPath" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
        </defs>
        <text fill="#ff5a1f" fontSize="12" fontWeight="700" letterSpacing="2.5">
          <textPath href="#sealPath" startOffset="0">
            REAL PEOPLE • REAL RESULTS •&nbsp;
          </textPath>
        </text>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="10" stroke="#ff5a1f" strokeWidth="1.5" strokeOpacity="0.7" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="#ff5a1f" strokeWidth="1.5" strokeOpacity="0.7" />
        </svg>
      </span>
    </div>
  )
}
