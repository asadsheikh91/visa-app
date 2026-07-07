import type { ReactNode } from 'react'
import clsx from 'clsx'

/**
 * SectionHeader — the shared centered eyebrow + heading + subtitle block
 * used at the top of every landing section. Server-compatible (no hooks).
 */
interface SectionHeaderProps {
  eyebrow: string
  title: ReactNode
  subtitle?: ReactNode
  /** id applied to the <h2>, so the parent <section> can aria-labelledby it. */
  headingId?: string
  className?: string
}

export function SectionHeader({ eyebrow, title, subtitle, headingId, className }: SectionHeaderProps) {
  return (
    <div className={clsx('mb-12 text-center', className)}>
      <p className="section-label mb-3">{eyebrow}</p>
      <h2 id={headingId} className="mb-3 text-2xl font-bold text-white sm:text-3xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
          {subtitle}
        </p>
      )}
    </div>
  )
}
