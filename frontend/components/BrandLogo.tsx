/**
 * ParchiVisa wordmark — orange "PV" ring + wordmark, tuned for the site's dark
 * background (white wordmark). Font matches the project's Inter body font.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 250 60" role="img" aria-label="ParchiVisa" className={className}>
      <circle cx="30" cy="30" r="22" fill="none" stroke="#FF5A1F" strokeWidth="4" />
      <text
        x="30"
        y="30"
        fill="#FF5A1F"
        fontFamily="Inter, sans-serif"
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
        fill="#FFFFFF"
        fontFamily="Inter, sans-serif"
        fontSize="26"
        fontWeight="700"
        dominantBaseline="central"
      >
        ParchiVisa
      </text>
    </svg>
  )
}
