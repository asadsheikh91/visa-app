import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * DocCard — the shared "official document" surface for the app.
 *
 * Distilled from the landing hero's DocumentCard (components/landing/paper/
 * Hero.tsx): a white bordered slip on the paper ground, with an optional
 * perforated tear-off top edge and a mono uppercase header. The whole app's
 * cards should be this, so the checker/dashboard read like the landing.
 */
export function DocCard({
  children,
  className,
  header,
  perforated = false,
  shadow = true,
  padded = true,
  ...rest
}: {
  children: ReactNode
  className?: string
  /** Optional mono uppercase header rendered inside a hairline-ruled top row. */
  header?: ReactNode
  /** Perforated tear-off edge along the top (the "parchi" slip cue). */
  perforated?: boolean
  /** Offset ink drop shadow. */
  shadow?: boolean
  /** Default inner padding. Set false to lay out sections manually. */
  padded?: boolean
} & ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={clsx(
        'relative rounded-[4px] border border-hairline bg-white',
        shadow && 'shadow-[6px_6px_0_0] shadow-ink/10',
        className
      )}
      {...rest}
    >
      {perforated && (
        <div
          aria-hidden="true"
          className="absolute -top-[5px] left-0 right-0 h-[10px]"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--pv-paper) 3px, transparent 3.5px)',
            backgroundSize: '16px 10px',
            backgroundRepeat: 'repeat-x',
            backgroundPosition: 'center',
          }}
        />
      )}
      {header != null && (
        <div className="border-b border-hairline px-6 py-3.5">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-ink">
            {header}
          </span>
        </div>
      )}
      <div className={clsx(padded && 'p-6')}>{children}</div>
    </div>
  )
}
