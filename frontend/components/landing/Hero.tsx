import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { ReadinessCard } from './ReadinessCard'

const trustPoints = ['From fact check', 'Results in under 5 minutes', 'Country-specific scoring']
const delay = (ms: number): CSSProperties => ({ ['--reveal-delay']: `${ms}ms` } as CSSProperties)

export function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      aria-labelledby="hero-heading"
    >
      <DesktopHero />
      <MobileHero />
    </section>
  )
}

function DesktopHero() {
  return (
    <div className="relative z-10 mx-auto hidden max-w-[1440px] px-20 pb-24 pt-[150px] lg:block">
      <div className="flex items-start justify-center gap-x-10">
        <div className="flex flex-1 justify-start">
          <SideNote
            icon={<ShieldCheck size={34} className="text-[#FF5F8F]" />}
            title={
              <>
                Before
                <span className="block text-[#FF5F8F]">you apply.</span>
              </>
            }
            body={
              <>
                Avoid surprises.
                <br />
                Check your visa
                <br />
                readiness first.
              </>
            }
            dividerClassName="from-[#673BFF] to-[#A13CFF]"
            className="w-[210px] pt-16"
            style={delay(180)}
          />
        </div>

        <main className="w-[620px] shrink-0 text-center">
          <div className="reveal-up flex justify-center" style={delay(40)}>
            <Badge />
          </div>

          <h1
            id="hero-heading"
            className="reveal-up mx-auto mt-7 max-w-[500px] text-balance text-[28px] font-normal leading-[1.18] text-white"
            style={delay(100)}
          >
            <span className="gradient-text font-extrabold">ParchiVisa</span> reviews your profile and
            documents, then shows how ready your application looks with clear gaps to fix before you apply.
          </h1>

          <div className="reveal-up mt-8 flex items-center justify-center gap-4" style={delay(220)}>
            <PrimaryCta />
            <SecondaryCta />
          </div>

          <TrustPoints />
        </main>

        <div className="flex flex-1 justify-end">
          <SideNote
            icon={<Target size={35} className="text-[#FF6A2A]" />}
            title={
              <>
                Know your
                <span className="block">visa</span>
                <span className="block text-[#FF5F8F]">readiness.</span>
              </>
            }
            body={
              <>
                Apply with confidence.
                <br />
                Know exactly where
                <br />
                you stand.
              </>
            }
            dividerClassName="from-[#FF6A2A] to-[#FF9F1C]"
            className="w-[240px] pt-16"
            style={delay(180)}
          />
        </div>
      </div>

      <div className="reveal-up mx-auto mt-10 w-[780px] max-w-full" style={delay(760)}>
        <ReadinessCard />
      </div>
    </div>
  )
}

function MobileHero() {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-5 pb-16 pt-28 lg:hidden">
      <div className="text-center">
        <div className="reveal-up flex justify-center" style={delay(40)}>
          <Badge />
        </div>

        <h1
          className="reveal-up mx-auto mt-6 text-balance text-[2rem] font-normal leading-tight text-white sm:text-[2.4rem]"
          style={delay(100)}
        >
          <span className="gradient-text font-extrabold">ParchiVisa</span> reviews your profile and
          documents, then shows how ready your application looks before you apply.
        </h1>

        <div
          className="reveal-up mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={delay(220)}
        >
          <PrimaryCta />
          <SecondaryCta />
        </div>

        <TrustPoints />
      </div>

      <div className="reveal-up mt-10" style={delay(520)}>
        <ReadinessCard />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SideNote
          icon={<ShieldCheck size={28} className="text-[#FF5F8F]" />}
          title={
            <>
              Before
              <span className="block text-[#FF5F8F]">you apply.</span>
            </>
          }
          body={<>Avoid surprises. Check your visa readiness first.</>}
          dividerClassName="from-[#673BFF] to-[#A13CFF]"
          className="glass rounded-2xl p-5 text-center"
          centered
          style={delay(620)}
        />
        <SideNote
          icon={<Target size={28} className="text-[#FF6A2A]" />}
          title={
            <>
              Know your
              <span className="block text-[#FF5F8F]">visa readiness.</span>
            </>
          }
          body={<>Apply with confidence. Know exactly where you stand.</>}
          dividerClassName="from-[#FF6A2A] to-[#FF9F1C]"
          className="glass rounded-2xl p-5 text-center"
          centered
          style={delay(700)}
        />
      </div>
    </div>
  )
}

function SideNote({
  icon,
  title,
  body,
  dividerClassName,
  className,
  style,
  centered = false,
}: {
  icon: ReactNode
  title: ReactNode
  body: ReactNode
  dividerClassName: string
  className?: string
  style?: CSSProperties
  centered?: boolean
}) {
  return (
    <div className={`reveal-up text-center ${className ?? ''}`} style={style}>
      <div className="mb-5 flex justify-center">
        <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full border border-white/15 bg-white/[0.04] shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          {icon}
        </span>
      </div>
      <h2 className="text-[26px] font-extrabold leading-[1.12] text-white">{title}</h2>
      <span className={`my-4 mx-auto block h-[3px] w-10 rounded-full bg-gradient-to-r ${dividerClassName}`} />
      <p className="text-[15px] leading-relaxed text-slate-300">{body}</p>
    </div>
  )
}

function Badge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur-sm">
      <Sparkles size={13} className="text-[#A13CFF]" />
      <span className="gradient-text">AI-Powered Visa Readiness</span>
    </span>
  )
}

function PrimaryCta() {
  return (
    <Link
      href="/tools/student-visa/countries"
      className="btn-primary hover-glow px-7 py-3.5 text-base"
    >
      Check Your Visa Readiness
      <ArrowRight size={18} />
    </Link>
  )
}

function SecondaryCta() {
  return (
    <Link href="/tools" className="btn-secondary hover-glow px-7 py-3.5 text-base">
      Explore Tools
    </Link>
  )
}

function TrustPoints() {
  return (
    <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
      {trustPoints.map((point, i) => (
        <li
          key={point}
          className="reveal-up flex items-center gap-2 text-sm text-slate-300"
          style={delay(360 + i * 120)}
        >
          <CheckCircle2 size={16} className="text-[#A13CFF]" />
          {point}
        </li>
      ))}
    </ul>
  )
}
