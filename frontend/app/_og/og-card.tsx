import { ImageResponse } from 'next/og'

/**
 * Shared renderer for every opengraph-image.tsx route.
 *
 * Lives in a `_`-prefixed folder so the App Router treats it as private and
 * never routes to it. Font files sit alongside this module, so the
 * `new URL('./x.ttf', import.meta.url)` references below resolve identically no
 * matter how deep in the route tree the caller is.
 *
 * Satori (the engine behind ImageResponse) is NOT a browser:
 *   - flexbox only, no CSS grid
 *   - every element needs an explicit `display`
 *   - no external stylesheets, no Tailwind classes, no CSS variables
 *   - fonts must be supplied as ArrayBuffers in the `fonts` array (woff2 is
 *     unsupported, which is why these are .ttf and not the .woff2 files
 *     next/font already produces for the site)
 * The colours below are therefore hard-coded copies of the pv tokens rather
 * than var() references. Keep them in sync with app/pv-tokens.css.
 */

const PAPER = '#F5EBD6' // --pv-paper
const INK = '#14213D' // --pv-ink
const SUPPORT = '#6B6560' // --pv-support
const HAIRLINE = '#E8DFC8' // --pv-hairline
const STAMP = '#1F6B4A' // --pv-stamp

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

const SERIF = 'PV Serif'
const MONO = 'PV Mono'

async function loadFonts() {
  const [serif, mono, monoSemibold] = await Promise.all([
    fetch(new URL('./LibreCaslonDisplay-Regular.ttf', import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL('./IBMPlexMono-Regular.ttf', import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL('./IBMPlexMono-SemiBold.ttf', import.meta.url)).then((r) => r.arrayBuffer()),
  ])
  return [
    { name: SERIF, data: serif, weight: 400 as const, style: 'normal' as const },
    { name: MONO, data: mono, weight: 400 as const, style: 'normal' as const },
    { name: MONO, data: monoSemibold, weight: 600 as const, style: 'normal' as const },
  ]
}

export interface OgCardProps {
  /** Mono, uppercase, letterspaced kicker above the headline. */
  eyebrow: string
  /** The one sentence the card exists to deliver. Serif, ink. */
  headline: string
  /**
   * Headline size in px. Default suits ~70 characters over two lines; drop it
   * for longer copy so the card never overflows 630px.
   */
  headlineSize?: number
}

/** Sized so the reference headline sets on two lines within the 1040px column. */
const DEFAULT_HEADLINE_SIZE = 74

/**
 * Deliberately NOT a render of the hero's sample report card — that card's
 * score is data, and baking data into a share image freezes it into every
 * cached unfurl on every platform.
 */
export async function ogCard({
  eyebrow,
  headline,
  headlineSize = DEFAULT_HEADLINE_SIZE,
}: OgCardProps) {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: PAPER,
          // The 3px ink top edge is the gov-site convention the nav already
          // uses — the one brand cue that survives being scaled to a thumbnail.
          borderTop: `12px solid ${INK}`,
          padding: '76px 80px 64px',
          justifyContent: 'space-between',
        }}
      >
        {/* flex: 1 + centred, so the eyebrow/headline block sits optically in
            the card rather than clinging to the top edge with a pool of dead
            paper above the rule. */}
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: MONO,
              fontWeight: 600,
              fontSize: 24,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: SUPPORT,
            }}
          >
            {eyebrow}
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 40,
              fontFamily: SERIF,
              fontSize: headlineSize,
              lineHeight: 1.14,
              letterSpacing: '-0.015em',
              color: INK,
            }}
          >
            {headline}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', height: 1, backgroundColor: HAIRLINE }} />
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              fontFamily: MONO,
              fontWeight: 600,
              fontSize: 26,
              letterSpacing: '0.08em',
              color: STAMP,
            }}
          >
            parchivisa.app
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadFonts() }
  )
}
