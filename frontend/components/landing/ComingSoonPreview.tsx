import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { Clock, ArrowRight, Bell, AlertTriangle, Sparkles } from 'lucide-react'

export type ComingSoonProps = {
  icon: LucideIcon
  /** Product name, shown large in the display font. */
  title: string
  /** One punchy line under the title. */
  lede: string
  /** The fear this will eventually answer, in the student's own voice. */
  worry: string
  /** Why that worry is dangerous — the stakes. */
  stakes: string
  /** What the tool will do once it's live. */
  bullets: string[]
  /** A live tool to send people to in the meantime. */
  meanwhile: { href: string; label: string }
  /** Pre-filled "notify me" email subject. */
  notifySubject: string
}

/**
 * A module that isn't switched on yet — presented honestly, but still made to
 * earn its place by naming the pain it will solve. Used for the AI tools (SOP
 * reviewer, mock interview) and the agency workspace until they go live.
 */
export function ComingSoonPreview({
  icon: Icon,
  title,
  lede,
  worry,
  stakes,
  bullets,
  meanwhile,
  notifySubject,
}: ComingSoonProps) {
  return (
    <div className="relative mx-auto max-w-2xl px-4 sm:px-6 py-12">
      {/* Ambient warmth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,90,31,0.12),transparent_60%)]"
      />

      <div className="relative">
        {/* Status + icon */}
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ff5a1f]/30 bg-[#ff5a1f]/10">
            <Icon size={22} className="text-[#ff5a1f]" aria-hidden />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-slate-800/60 px-3 py-1 text-xs font-semibold text-slate-300">
            <Clock size={11} />
            Coming soon
          </span>
        </div>

        <h1 className="mt-6 font-serif text-[clamp(2.25rem,6vw,3.5rem)] uppercase leading-[0.95] tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-slate-300">{lede}</p>

        {/* The pain — named even though the fix isn't live yet */}
        <div className="mt-8 rounded-2xl border border-fail/30 bg-red-500/[0.04] p-5 sm:p-6">
          <p className="flex items-start gap-2.5 text-balance text-lg font-bold leading-snug text-ink">
            <AlertTriangle size={18} className="mt-1 flex-shrink-0 text-fail-text" aria-hidden />
            {worry}
          </p>
          <p className="mt-2.5 pl-8 text-sm leading-relaxed text-slate-400">{stakes}</p>
        </div>

        {/* What it'll do */}
        <div className="mt-5 rounded-2xl border border-line-1 bg-[#ff5a1f]/[0.04] p-5 sm:p-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#ffb05a]">
            <Sparkles size={13} />
            What it&apos;ll do
          </p>
          <ul className="mt-4 space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-300">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#ff5a1f]" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href={`mailto:hello@parchivisa.com?subject=${encodeURIComponent(notifySubject)}`}
            className="btn-primary justify-center text-sm"
          >
            <Bell size={15} />
            Tell me when it&apos;s live
          </a>
          <Link
            href={meanwhile.href}
            className="group inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-300 transition-colors hover:text-ink"
          >
            {meanwhile.label}
            <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          We&apos;d rather ship this right than ship it early — a tool that gives you the wrong
          confidence before an interview is worse than no tool at all.
        </p>
      </div>
    </div>
  )
}
