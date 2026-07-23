import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { Rails } from './Rails'

type Tone = 'paper' | 'paper-alt' | 'ink' | 'transparent'
type Width = 'content' | 'wide' | 'full'

/**
 * Full-bleed band primitive for the landing page.
 *
 * The outer element always paints its tone edge to edge (width:100% — never
 * 100vw, so no horizontal scrollbar); only the inner container is constrained
 * (--container-content / --container-wide) with --gutter padding and --band-y
 * vertical rhythm. `tone="ink"` flips to the light-on-dark text set.
 *
 * `railed` reserves the --rail margin-furniture column on the RIGHT, desktop
 * only — the document's stamp/annotation margin. No furniture renders yet;
 * the space is just held.
 */
const toneClass: Record<Tone, string> = {
  paper: 'bg-paper text-ink',
  'paper-alt': 'bg-paper-deep text-ink',
  ink: 'bg-ink text-paper',
  transparent: 'bg-transparent text-ink',
}

const widthClass: Record<Width, string> = {
  content: 'max-w-content',
  wide: 'max-w-wide',
  full: 'max-w-none',
}

type SectionOwnProps<T extends ElementType> = {
  tone?: Tone
  width?: Width
  /** Render the margin furniture (see Rails). Desktop ≥1280 only. */
  railed?: boolean
  /** Right rail, top-anchored — e.g. "§ 01". Only meaningful with `railed`. */
  railNumber?: string
  /** Right rail, bottom-anchored caption. Only meaningful with `railed`. */
  railCaption?: string
  as?: T
  /** Extra classes for the full-bleed outer element (e.g. relative, overflow). */
  className?: string
  /** Extra classes for the constrained inner container. */
  innerClassName?: string
  children: ReactNode
}

export function Section<T extends ElementType = 'section'>({
  tone = 'paper',
  width = 'content',
  railed = false,
  railNumber,
  railCaption,
  as,
  className,
  innerClassName,
  children,
  ...rest
}: SectionOwnProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof SectionOwnProps<T>>) {
  const Comp = (as ?? 'section') as ElementType

  return (
    <Comp
      className={clsx('w-full', toneClass[tone], railed && 'relative', className)}
      {...rest}
    >
      <div
        className={clsx(
          'mx-auto px-gutter py-band',
          widthClass[width],
          // Rails anchor to THIS box's edges, so they track the container
          // rather than the viewport.
          railed && 'relative lg:pr-[calc(var(--gutter)+var(--rail))]',
          innerClassName
        )}
      >
        {railed && (
          <Rails sectionNo={railNumber} caption={railCaption} inverted={tone === 'ink'} />
        )}
        {children}
      </div>
    </Comp>
  )
}
