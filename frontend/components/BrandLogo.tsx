/**
 * ParchiVisa wordmark — "The Official Document" paper theme.
 * Stamp-green "PV" ring + ink serif wordmark, tuned for the paper ground.
 * (The nav/footer use the StampMark + serif lockup directly; this SVG mark is
 * kept paper-safe for anywhere a single self-contained wordmark is needed.)
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 250 60" role="img" aria-label="ParchiVisa" className={className}>
      <circle cx="30" cy="30" r="22" fill="none" stroke="#1F6B4A" strokeWidth="4" />
      <text
        x="30"
        y="30"
        fill="#1F6B4A"
        fontFamily="var(--font-pv-serif, Georgia, serif)"
        fontSize="20"
        fontWeight="700"
        textAnchor="middle"
        dominantBaseline="central"
        letterSpacing="0.5"
      >
        PV
      </text>
      <text
        x="64"
        y="30"
        fill="#14213D"
        fontFamily="var(--font-pv-serif, Georgia, serif)"
        fontSize="26"
        fontWeight="500"
        dominantBaseline="central"
      >
        ParchiVisa
      </text>
    </svg>
  )
}
