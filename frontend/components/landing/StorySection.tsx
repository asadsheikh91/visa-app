'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import {
  GraduationCap,
  Landmark,
  FileStack,
  ListChecks,
  CalendarClock,
  FileText,
  MessagesSquare,
  Route,
  ArrowRight,
  ShieldCheck,
  Clock,
} from 'lucide-react'

type Status = 'live' | 'soon'

type Chapter = {
  n: string
  icon: LucideIcon
  /** The student's own worry, in their voice. */
  worry: string
  /** The dread spelled out — why this is how a refusal actually happens. */
  stakes: string
  module: string
  /** What our module does about it, benefit-first. */
  fix: string
  status: Status
  href: string | null
  cta: string
}

/**
 * The spine of the landing page: every chapter is a real reason a genuine
 * student gets refused, paired with the ParchiVisa module that removes it.
 * Modules that aren't switched on yet are told honestly ("soon") — the pain is
 * still named, because the fear is real whether or not the fix is live.
 */
const chapters: Chapter[] = [
  {
    n: '01',
    icon: GraduationCap,
    worry: '“Am I actually ready — or am I about to find out the hard way?”',
    stakes:
      'You only get to apply once per intake. Submit a weak profile and the refusal letter won’t even tell you what went wrong — just that it did. Months and fees, gone on a guess.',
    module: 'Readiness Checker',
    fix: 'A real readiness score for the UK, USA, Canada or Australia — every weak spot named, every fix spelled out, before you spend a rupee on the application.',
    status: 'live',
    href: '/tools/student-visa/countries',
    cta: 'Check my readiness',
  },
  {
    n: '02',
    icon: Landmark,
    worry: '“My bank balance is fine — I’ve had the money for ages.”',
    stakes:
      'The most common silent rejection there is. The money landed three days late, or sat in the wrong account, and broke the 28-day rule. There is no appeal for this. None.',
    module: 'Bank Statement Checker',
    fix: 'Enter your figures and we test them against the actual financial rules — 28-day hold, required balance, recency. The rules decide, not a guess and not an AI.',
    status: 'live',
    href: '/tools/financial-document',
    cta: 'Check my finances',
  },
  {
    n: '03',
    icon: FileStack,
    worry: '“Which document do I even get first?”',
    stakes:
      'Get the order wrong and you wait three weeks for an attestation that needed another paper first. The embassy won’t warn you. An agent will charge you to find out.',
    module: 'Document Guide',
    fix: 'Your exact documents, in the right order, each from its official source — with the legal fast-track for the ones you’re running out of time on. No agents, no shortcuts.',
    status: 'live',
    href: '/tools/document-guide',
    cta: 'Map my documents',
  },
  {
    n: '04',
    icon: ListChecks,
    worry: '“Okay, I have a score. Now what do I actually do?”',
    stakes:
      'A number you can’t act on is just more anxiety. This is where most people freeze — and lose the two weeks that would have fixed everything.',
    module: 'Action Plan',
    fix: 'We turn every gap in your profile into a clear, ordered to-do list — what to fix, in what order, so the next time you check, the score moves.',
    status: 'live',
    href: '/dashboard',
    cta: 'Build my plan',
  },
  {
    n: '05',
    icon: CalendarClock,
    worry: '“What if there’s a deadline I don’t even know about?”',
    stakes:
      'CAS letters, biometrics, the tuition deposit, the financial hold period — miss one date and the whole application falls like dominoes. Intake gone, deposit gone.',
    module: 'Deadline Planner',
    fix: 'Every date you need, mapped backwards from your intake, so you’re never blindsided by a deadline you should have started six weeks ago.',
    status: 'live',
    href: '/timeline',
    cta: 'See my timeline',
  },
  {
    n: '06',
    icon: FileText,
    worry: '“My SOP sounds like everyone else’s.”',
    stakes:
      'Officers read thousands of these. A copy-paste, “I’ve always dreamed” statement reads as a non-genuine student — and that verdict has no appeal either.',
    module: 'SOP Reviewer',
    fix: 'Paste your statement and get an officer’s-eye read on genuineness, ties to home, and the red flags that quietly get people refused.',
    status: 'soon',
    href: null,
    cta: 'Coming soon',
  },
  {
    n: '07',
    icon: MessagesSquare,
    worry: '“The interview decides everything — and I’ve never practised.”',
    stakes:
      'One nervous, contradictory answer about your funds or your plans and your credibility is gone. You don’t get a second interview to redo it.',
    module: 'Mock Interview',
    fix: 'A realistic credibility interview you can practise as many times as you need, scored on the things an officer is actually listening for.',
    status: 'soon',
    href: null,
    cta: 'Coming soon',
  },
  {
    n: '08',
    icon: Route,
    worry: '“I feel like I’m doing this completely alone.”',
    stakes:
      'No senior who’s been through it, no agent you fully trust. Just forums full of contradictions and a decision that will shape the next ten years of your life.',
    module: 'Guided Journey & Real Outcomes',
    fix: 'A step-by-step path from first check to visa day — and real, anonymised outcomes from students with profiles like yours, so you can see what actually worked.',
    status: 'live',
    href: '/dashboard',
    cta: 'Start my journey',
  },
]

export function StorySection() {
  const reduce = useReducedMotion()

  // Scroll progress is scoped to the chapter list, not the whole page, so the
  // beam fills exactly as the chapters travel from the top to the bottom of
  // the viewport. offset start/end 'center' aligns the beam front with the
  // viewport midline, which is also where each badge lights up.
  const listRef = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ['start center', 'end center'],
  })

  // The animated fill grows downward via a GPU transform (scaleY), overlaid on
  // the existing static spine. A separate glowing head dot translates down the
  // measured track length — also transform-only, no layout thrash per frame.
  const beamRef = useRef<HTMLSpanElement>(null)
  const [trackHeight, setTrackHeight] = useState(0)
  useEffect(() => {
    const el = beamRef.current
    if (!el) return
    const measure = () => setTrackHeight(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fillScaleY = useTransform(scrollYProgress, [0, 1], [0, 1])
  const headY = useTransform(scrollYProgress, [0, 1], [-6, trackHeight - 6])
  const headOpacity = useTransform(scrollYProgress, [0, 0.02, 0.98, 1], [0, 1, 1, 0])

  return (
    <section
      id="story"
      aria-labelledby="story-heading"
      className="relative px-5 py-24 sm:px-8 lg:px-20 lg:py-32"
    >
      {/* Ambient warmth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,90,31,0.10),transparent_45%)]"
      />

      <div className="relative mx-auto max-w-[1080px]">
        {/* Intro */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#ffb05a]">
            Why visas really get refused
          </p>
          <h2
            id="story-heading"
            className="mt-5 font-display text-[clamp(2.25rem,5vw,3.75rem)] uppercase leading-[0.95] tracking-tight text-white"
          >
            A refusal is never{' '}
            <span className="text-[#ff5a1f]" style={{ textShadow: '0 0 34px rgba(255,90,31,0.4)' }}>
              random.
            </span>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-slate-300 sm:text-lg">
            Genuine students get refused every single day — almost always for something small,
            silent and completely fixable. Here&apos;s every place it goes wrong, and exactly how
            we catch it first.
          </p>
        </div>

        {/* Chapters — a vertical journey from first doubt to visa day */}
        <ol ref={listRef} className="relative mt-16 space-y-5">
          {/* Connecting spine — the static track */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-6 left-[27px] top-6 w-px bg-gradient-to-b from-[#ff5a1f]/40 via-white/10 to-transparent sm:left-[31px]"
          />

          {/* Tracing beam — scroll-linked glow overlaid on the static track */}
          <span
            ref={beamRef}
            aria-hidden
            className="pointer-events-none absolute bottom-6 left-[27px] top-6 w-px sm:left-[31px]"
          >
            {/* Fill trail: grows downward via scaleY (transform, GPU) */}
            <motion.span
              className="absolute inset-x-0 top-0 h-full origin-top rounded-full bg-gradient-to-b from-[#ff5a1f] via-[#ff7a3c] to-[#ff5a1f] shadow-[0_0_12px_1px_rgba(255,90,31,0.55)]"
              style={{ scaleY: reduce ? 1 : fillScaleY }}
            />
            {/* Glowing head: rides the beam front, translateY only */}
            <motion.span
              className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-[#ff8a4c] shadow-[0_0_16px_5px_rgba(255,90,31,0.8)]"
              style={{ y: reduce ? trackHeight - 6 : headY, opacity: reduce ? 0 : headOpacity }}
            />
          </span>

          {chapters.map((c) => (
            <ChapterRow key={c.n} chapter={c} />
          ))}
        </ol>

        {/* Trust close — the through-line under everything */}
        <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-line-2 bg-tint-2 px-6 py-7 text-center backdrop-blur-md sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-start gap-3.5">
            <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#ff5a1f]/30 bg-[#ff5a1f]/10">
              <ShieldCheck size={18} className="text-[#ff5a1f]" aria-hidden />
            </span>
            <div>
              <p className="font-bold text-white">Every word traced to an official source.</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">
                Rules change quietly, and last year&apos;s checklist gets people refused this year.
                We date every rule and show you where it came from.
              </p>
            </div>
          </div>
          <Link
            href="/trust"
            className="group inline-flex flex-shrink-0 items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-[#ff7a3c]"
          >
            See our sources
            <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function ChapterRow({ chapter: c }: { chapter: Chapter }) {
  const { icon: Icon, status } = c
  const live = status === 'live'

  // The badge lights up as the beam front (the viewport midline) reaches it and
  // dims again once scrolled past or not yet reached. useInView flips a boolean
  // only on threshold crossings — no per-frame re-render of the row.
  const reduce = useReducedMotion()
  const markerRef = useRef<HTMLSpanElement>(null)
  const inView = useInView(markerRef, { margin: '-20% 0px -45% 0px' })
  const active = reduce ? true : inView

  return (
    <li className="relative pl-16 sm:pl-20">
      {/* Node marker on the spine */}
      <span
        ref={markerRef}
        className={`absolute left-0 top-1 flex h-14 w-14 items-center justify-center rounded-2xl border backdrop-blur-md transition-all duration-500 sm:h-16 sm:w-16 ${
          active
            ? 'border-[#ff5a1f]/50 bg-[#ff5a1f]/10 text-[#ff5a1f] shadow-[0_0_34px_-4px_rgba(255,90,31,0.65)] scale-105'
            : 'border-white/10 bg-white/[0.03] text-slate-500'
        }`}
        aria-hidden
      >
        <Icon size={22} />
      </span>

      <article className="group rounded-2xl border border-line-1 bg-tint-1 p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-line-3 hover:bg-tint-2 sm:p-6">
        {/* Chapter index + status */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="font-mono text-xs font-semibold tracking-[0.2em] text-slate-500">
            CHAPTER {c.n}
          </span>
          {live ? (
            <span className="badge-green text-[11px]">Live now</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-800/60 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
              <Clock size={10} />
              Coming soon
            </span>
          )}
        </div>

        {/* The worry — in the student's own voice */}
        <p className="text-balance text-lg font-bold leading-snug text-white sm:text-xl">
          {c.worry}
        </p>

        {/* The stakes */}
        <p className="mt-2.5 text-sm leading-relaxed text-slate-400">{c.stakes}</p>

        {/* The turn — our module */}
        <div className="mt-4 rounded-xl border border-line-1 bg-[#ff5a1f]/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ffb05a]">
            {live ? `The fix · ${c.module}` : `Almost here · ${c.module}`}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{c.fix}</p>

          {live && c.href ? (
            <Link
              href={c.href}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#ff5a1f] transition-colors hover:text-[#ff7a3c]"
            >
              {c.cta}
              <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
              <Clock size={13} />
              {c.cta} — we&apos;ll tell you the day it opens
            </span>
          )}
        </div>
      </article>
    </li>
  )
}
