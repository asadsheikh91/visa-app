'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BadgeCheck, Quote } from 'lucide-react'
import clsx from 'clsx'

// ---------------------------------------------------------------------------
// Reviews — Pakistani students, one per supported route where possible.
// Headline is the bold pull-quote; body expands on it.
// ---------------------------------------------------------------------------

interface Review {
  headline: React.ReactNode
  body: string
  name: string
  city: string
  route: string
  initials: string
  /** Tailwind gradient classes for the avatar disc */
  avatar: string
}

const REVIEWS: Review[] = [
  {
    headline: (
      <>It caught the exact <span className="text-[#ff5a1f]">bank statement mistake</span> that gets people refused.</>
    ),
    body: 'I had no idea my funds needed to stay untouched for 28 days. ParchiVisa flagged it before I booked my biometrics — my consultant never mentioned it once.',
    name: 'Ayesha Khan',
    city: 'Lahore',
    route: 'UK Student Visa',
    initials: 'AK',
    avatar: 'from-[#ffb05a] to-[#ff5a1f]',
  },
  {
    headline: (
      <>Five websites, five different answers. This one showed me <span className="text-[#ff5a1f]">my actual gaps</span>.</>
    ),
    body: 'Everything else was generic advice copied from forums. Here I answered questions about my own case and got a readiness score with the exact things to fix.',
    name: 'Hamza Farooq',
    city: 'Karachi',
    route: 'USA F-1 Student Visa',
    initials: 'HF',
    avatar: 'from-[#ff8a4a] to-[#e04a12]',
  },
  {
    headline: (
      <>My readiness score told me to <span className="text-[#ff5a1f]">wait a month</span> — and it was right.</>
    ),
    body: 'I was about to apply with weak proof of funds. The checker showed exactly why it would raise flags, so I fixed my sponsor documents first instead of gambling the fee.',
    name: 'Fatima Zahra',
    city: 'Islamabad',
    route: 'Canada Study Permit',
    initials: 'FZ',
    avatar: 'from-[#ffc27a] to-[#ff6a2a]',
  },
  {
    headline: (
      <>I finally understood <span className="text-[#ff5a1f]">why my cousin got refused</span> — and how not to repeat it.</>
    ),
    body: 'His refusal letter made no sense to us. Ten minutes on ParchiVisa and I could see the exact rule he missed. I went through my own file line by line after that.',
    name: 'Muhammad Bilal',
    city: 'Faisalabad',
    route: 'UK Student Visa',
    initials: 'MB',
    avatar: 'from-[#ff9a3c] to-[#d94510]',
  },
  {
    headline: (
      <>The checklist felt like it was written <span className="text-[#ff5a1f]">for me</span>, not for everyone.</>
    ),
    body: 'It asked about my sponsor, my gap year, my city — and the document list changed based on my answers. That is the part no free PDF checklist ever does.',
    name: 'Usman Javed',
    city: 'Rawalpindi',
    route: 'Australia Student Visa (500)',
    initials: 'UJ',
    avatar: 'from-[#ffb05a] to-[#ff5a1f]',
  },
  {
    headline: (
      <>No agent drama. Just a <span className="text-[#ff5a1f]">clear list</span> of what I was missing.</>
    ),
    body: 'Agents in my city quoted me two lakh rupees just to "review" my file. ParchiVisa showed me the same weak points in two minutes, with the official rules linked.',
    name: 'Zainab Raza',
    city: 'Multan',
    route: 'UK Student Visa',
    initials: 'ZR',
    avatar: 'from-[#ff8a4a] to-[#e04a12]',
  },
  {
    headline: (
      <>It flagged my <span className="text-[#ff5a1f]">sponsor documents</span> before the embassy could.</>
    ),
    body: 'My uncle was sponsoring me and I assumed a signed letter was enough. The checker showed exactly what evidence a sponsored application actually needs.',
    name: 'Ali Haider',
    city: 'Peshawar',
    route: 'Canada Study Permit',
    initials: 'AH',
    avatar: 'from-[#ffc27a] to-[#ff6a2a]',
  },
  {
    headline: (
      <>Two minutes of questions saved me <span className="text-[#ff5a1f]">weeks of guessing</span>.</>
    ),
    body: 'I kept postponing my application because I did not know if my file was ready. Now I have a score, a list of fixes, and an order to do them in.',
    name: 'Mariam Siddiqui',
    city: 'Hyderabad',
    route: 'USA F-1 Student Visa',
    initials: 'MS',
    avatar: 'from-[#ff9a3c] to-[#d94510]',
  },
]

const ROTATE_MS = 6500

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function TestimonialSection() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = useReducedMotion()
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const goTo = useCallback((i: number) => {
    setIndex(((i % REVIEWS.length) + REVIEWS.length) % REVIEWS.length)
  }, [])

  // Auto-advance; pauses on hover/focus so a review can actually be read.
  useEffect(() => {
    if (paused) return
    timer.current = setInterval(() => {
      setIndex((i) => (i + 1) % REVIEWS.length)
    }, ROTATE_MS)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [paused])

  const review = REVIEWS[index]

  return (
    <section
      id="testimonial"
      aria-label="What students say"
      className="relative px-5 py-24 sm:px-8 lg:px-20 lg:py-28"
    >
      <div className="relative mx-auto max-w-[1280px]">
        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-10 -bottom-8 top-10 rounded-full bg-[radial-gradient(ellipse_at_70%_60%,rgba(255,90,31,0.14),transparent_60%)] blur-2xl"
        />

        <div
          className="group glass-strong relative grid grid-cols-1 overflow-hidden rounded-[28px] border-line-2 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.85)] lg:grid-cols-[0.82fr_1fr]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          {/* Hover sheen */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/4 z-30 w-1/3 -translate-x-[180%] -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent transition-transform duration-[900ms] ease-out group-hover:translate-x-[420%]"
          />
          <PassportPanel index={index} total={REVIEWS.length} onSelect={goTo} />
          <QuotePanel review={review} index={index} reduceMotion={!!reduceMotion} />
        </div>

        {/* Mobile pagination dots (the passport rail is desktop-only) */}
        <Dots className="mt-6 flex justify-center gap-2 lg:hidden" index={index} onSelect={goTo} />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Left panel — passport illustration + live pagination rail
// ---------------------------------------------------------------------------

function PassportPanel({
  index,
  total,
  onSelect,
}: {
  index: number
  total: number
  onSelect: (i: number) => void
}) {
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

        {/* Country flag hint — Pakistan green + crescent field */}
        <rect x="80" y="222" width="20" height="14" rx="2" fill="#0e7a3d" opacity="0.85" />
        <rect x="100" y="222" width="20" height="14" rx="2" fill="rgba(255,255,255,0.18)" />
        <rect x="120" y="222" width="20" height="14" rx="2" fill="#ff5a1f" opacity="0.6" />
      </svg>

      {/* Vertical pagination — live, clickable */}
      <div className="absolute left-5 top-6 bottom-6 hidden flex-col items-center justify-between lg:flex">
        <span className="font-mono text-sm font-bold text-white">
          {String(index + 1).padStart(2, '0')}
        </span>
        <Dots className="flex flex-col items-center gap-1.5" index={index} onSelect={onSelect} />
        <span className="font-mono text-[11px] tracking-widest text-slate-400">
          {index + 1}/{String(total).padStart(2, '0')}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Right panel — the rotating quote
// ---------------------------------------------------------------------------

function QuotePanel({
  review,
  index,
  reduceMotion,
}: {
  review: Review
  index: number
  reduceMotion: boolean
}) {
  return (
    <div
      className="relative flex flex-col justify-center p-8 sm:p-12 lg:p-14"
      aria-live="polite"
    >
      <RealResultsSeal />

      <Quote size={52} className="text-[#ff5a1f] [text-shadow:0_0_30px_rgba(255,90,31,0.4)]" fill="currentColor" aria-hidden />

      {/* min-height keeps the card from jumping as quotes of different length rotate */}
      <div className="relative mt-5 min-h-[300px] sm:min-h-[280px] lg:min-h-[300px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.figure
            key={index}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14 }}
            transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <blockquote className="max-w-lg text-balance text-2xl font-extrabold leading-[1.2] text-white sm:text-[2rem]">
              {review.headline}
            </blockquote>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-300">
              {review.body}
            </p>

            <figcaption className="mt-8 flex items-center gap-3">
              <span
                className={clsx(
                  'flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-md',
                  review.avatar
                )}
                aria-hidden
              >
                {review.initials}
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white">{review.name}</span>
                  <BadgeCheck size={16} className="text-[#ff5a1f]" aria-hidden />
                </div>
                <p className="text-sm text-slate-400">
                  {review.city} · {review.route}
                </p>
              </div>
            </figcaption>
          </motion.figure>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared pagination dots
// ---------------------------------------------------------------------------

function Dots({
  index,
  onSelect,
  className,
}: {
  index: number
  onSelect: (i: number) => void
  className?: string
}) {
  return (
    <div className={className} role="tablist" aria-label="Reviews">
      {REVIEWS.map((r, i) => (
        <button
          key={r.name}
          type="button"
          role="tab"
          aria-selected={i === index}
          aria-label={`Review ${i + 1}: ${r.name}`}
          onClick={() => onSelect(i)}
          className={clsx(
            'h-1.5 w-1.5 rounded-full transition-all duration-300',
            i === index
              ? 'bg-[#ff5a1f] shadow-[0_0_6px_rgba(255,90,31,0.9)]'
              : 'bg-white/25 hover:bg-white/50'
          )}
        />
      ))}
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
