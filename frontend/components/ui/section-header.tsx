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
      {/* Type slots follow the document system: eyebrow = mono UPPERCASE
          (.section-label), title = serif sentence case, subtitle = body sans. */}
      <p className="section-label mb-3">{eyebrow}</p>
      <h2
        id={headingId}
        className="mb-3 font-serif text-[28px] font-medium leading-[1.1] tracking-[-0.01em] text-ink sm:text-[34px]"
      >
        {title}
      </h2>
      {subtitle && (
        <p className="measure mx-auto font-body text-[15px] leading-relaxed text-support sm:text-[16px]">
          {subtitle}
        </p>
      )}
    </div>
  )
}
