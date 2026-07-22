/**
 * Circular seal mark — the ParchiVisa stamp logo.
 * Pure currentColor SVG so it inherits ink/stamp/paper depending on context.
 */
const TICK_COUNT = 28

export function StampMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none">
      <circle cx="24" cy="24" r="21.75" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="15.5" stroke="currentColor" strokeWidth="1" />
      {Array.from({ length: TICK_COUNT }, (_, i) => {
        const a = (i / TICK_COUNT) * Math.PI * 2
        const cos = Math.cos(a)
        const sin = Math.sin(a)
        return (
          <line
            key={i}
            x1={24 + 17.2 * cos}
            y1={24 + 17.2 * sin}
            x2={24 + 19.4 * cos}
            y2={24 + 19.4 * sin}
            stroke="currentColor"
            strokeWidth="1"
          />
        )
      })}
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        style={{ font: '700 15px var(--font-pv-serif, Georgia, serif)', letterSpacing: '0.5px' }}
      >
        PV
      </text>
    </svg>
  )
}
