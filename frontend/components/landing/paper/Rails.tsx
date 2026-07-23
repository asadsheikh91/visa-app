import clsx from 'clsx'

/**
 * Margin furniture — the printed-form fittings that make the outer whitespace
 * read as deliberate rather than empty.
 *
 * Geometry note: below ~1616px there is no space *outside* the content
 * container at all — the container spans the viewport and its only margin is
 * the internal --gutter (51–64px). So the rails anchor to the container's
 * border-box edge and paint inward across that gutter band, which puts them
 * immediately outside the text column at every width (≈15px clear at 1280,
 * ≈50px at 1920) instead of stranded against the viewport edge. --rail (88px)
 * frames the column; the painted footprint is only ~26px of it, because
 * vertical text is one line-height wide.
 *
 * Vertical text uses writing-mode rather than rotate() so the element's box is
 * genuinely narrow — a rotated box would still reserve its unrotated width.
 *
 * Decoration only: aria-hidden, pointer-events-none, never focusable.
 */
const TICKS = 'repeating-linear-gradient(to bottom, currentColor 0 1px, transparent 1px 96px)'

export function Rails({
  sectionNo,
  caption,
  formLabel = 'Form PV-01 · Rev 2026.07',
  inverted = false,
}: {
  /** Right rail, top-anchored. e.g. "§ 01" */
  sectionNo?: string
  /** Right rail, bottom-anchored. Only where it says something true. */
  caption?: string
  /** Left rail, bottom-anchored. */
  formLabel?: string
  /** Flip to the light-on-dark set for tone="ink" bands. */
  inverted?: boolean
}) {
  // ~0.35 alpha: texture, not content.
  const tone = inverted ? 'text-paper/35' : 'text-ink/35'
  const ruleTone = inverted ? 'bg-paper/35' : 'bg-ink/35'
  // The 28px inset keeps a bottom-anchored label in one band from touching a
  // top-anchored label in the next one across the section seam.
  const label = clsx(
    'type-mono-micro absolute [writing-mode:vertical-rl] whitespace-nowrap',
    tone
  )
  const atTop = 'top-[28px]'
  const atBottom = 'bottom-[28px]'

  return (
    <div
      aria-hidden="true"
      // inset-0 on the container's padding box = full section height, edge to
      // edge of the container. Desktop only (xl = 1280px).
      className="pointer-events-none absolute inset-0 hidden select-none xl:block"
    >
      {/* ── Left rail: text | rule+ticks | (gutter) | text column ── */}
      <div className="absolute inset-y-0 left-0 w-rail">
        <div className={clsx('absolute inset-y-0 left-[30px] w-px', ruleTone)} />
        <div
          className={clsx('absolute inset-y-0 left-[30px] w-[6px]', tone)}
          style={{ backgroundImage: TICKS }}
        />
        {formLabel && (
          <span className={clsx(label, atBottom, 'left-[8px] rotate-180')}>{formLabel}</span>
        )}
      </div>

      {/* ── Right rail ── */}
      <div className="absolute inset-y-0 right-0 w-rail">
        <div className={clsx('absolute inset-y-0 right-[30px] w-px', ruleTone)} />
        <div
          className={clsx('absolute inset-y-0 right-[30px] w-[6px]', tone)}
          style={{ backgroundImage: TICKS }}
        />
        {sectionNo && <span className={clsx(label, atTop, 'right-[8px]')}>{sectionNo}</span>}
        {caption && <span className={clsx(label, atBottom, 'right-[8px]')}>{caption}</span>}
      </div>
    </div>
  )
}
