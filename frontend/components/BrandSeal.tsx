/**
 * BrandSeal — the ParchiVisa circular seal logo.
 *
 * Green outer ring, ink inner ring, cream ground, serif "PV" in the centre,
 * with "PARCHIVISA" arced across the top and "READY BEFORE REFUSED" across the
 * bottom. Rebuilt as scalable SVG so it stays crisp at every size and uses the
 * app's brand tokens. Colours are fixed (multi-colour mark); size it via
 * `className` (e.g. "h-10 w-10").
 *
 * NOTE: this is the full brand lockup. The monochrome StampMark
 * (components/landing/paper/StampMark) is kept separately for decorative
 * watermark/stamp uses where a single-colour, currentColor mark is wanted.
 */

const GREEN = '#1E7A4E'
const INK = '#14213D'
const CREAM = '#F6EFE2'

const CX = 100
const CY = 100

// 0° = 12 o'clock, angle increases clockwise.
function polar(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return {
    x: +(CX + r * Math.sin(rad)).toFixed(2),
    y: +(CY - r * Math.cos(rad)).toFixed(2),
  }
}

/** Per-glyph curved text so orientation is deterministic (no textPath quirks). */
function ArcText({
  text,
  radius,
  span,
  place,
  fill,
  fontSize,
  fontWeight = 500,
}: {
  text: string
  radius: number
  span: number
  place: 'top' | 'bottom'
  fill: string
  fontSize: number
  fontWeight?: number
}) {
  const chars = text.split('')
  const n = chars.length
  const step = n > 1 ? span / (n - 1) : 0

  return (
    <g>
      {chars.map((ch, i) => {
        // Top: left→right over the top, feet toward centre (upright at top).
        // Bottom: left(high angle)→right(low angle) along the bottom, feet
        // toward the rim (upright at the bottom).
        const angle =
          place === 'top' ? -span / 2 + i * step : 180 + span / 2 - i * step
        const rotation = +(place === 'top' ? angle : angle + 180).toFixed(2)
        const { x, y } = polar(radius, angle)
        return (
          <text
            key={i}
            x={x}
            y={y}
            fill={fill}
            fontFamily="var(--font-pv-serif, Georgia, serif)"
            fontSize={fontSize}
            fontWeight={fontWeight}
            textAnchor="middle"
            dominantBaseline="central"
            transform={`rotate(${rotation} ${x} ${y})`}
          >
            {ch}
          </text>
        )
      })}
    </g>
  )
}

export function BrandSeal({ className }: { className?: string }) {
  const dotL = polar(76, 270)
  const dotR = polar(76, 90)

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="ParchiVisa — Ready before refused"
    >
      {/* Coin + rings */}
      <circle cx={CX} cy={CY} r="95" fill={CREAM} stroke={GREEN} strokeWidth="2.5" />
      <circle cx={CX} cy={CY} r="90" fill="none" stroke={GREEN} strokeWidth="1" />
      <circle cx={CX} cy={CY} r="58" fill="none" stroke={INK} strokeWidth="2.5" />

      {/* Arced legends */}
      <ArcText text="PARCHIVISA" radius={76} span={150} place="top" fill={INK} fontSize={14} />
      <ArcText
        text="READY BEFORE REFUSED"
        radius={75}
        span={150}
        place="bottom"
        fill={INK}
        fontSize={10.5}
      />

      {/* Side separators between the two legends */}
      <rect
        x={+(dotL.x - 2).toFixed(2)}
        y={+(dotL.y - 2).toFixed(2)}
        width="4"
        height="4"
        fill={INK}
        transform={`rotate(45 ${dotL.x} ${dotL.y})`}
      />
      <rect
        x={+(dotR.x - 2).toFixed(2)}
        y={+(dotR.y - 2).toFixed(2)}
        width="4"
        height="4"
        fill={INK}
        transform={`rotate(45 ${dotR.x} ${dotR.y})`}
      />

      {/* Monogram */}
      <text
        x={CX}
        y="104"
        fill={GREEN}
        fontFamily="var(--font-pv-serif, Georgia, serif)"
        fontSize="62"
        fontWeight="600"
        textAnchor="middle"
        dominantBaseline="central"
      >
        PV
      </text>
    </svg>
  )
}
