import styles from './report.module.css'

/**
 * CRS estimate callout. Renders nothing for pathways where CRS is not applicable
 * (estCrs === null, e.g. student visas), so the section simply omits it.
 */
export function CrsCallout({
  estCrs,
  crsNote,
}: {
  estCrs: number | null
  crsNote: string
}) {
  if (estCrs === null) return null
  return (
    <div className={styles.callout}>
      <div className={styles.big}>
        ~{Math.round(estCrs)}
        <small>Est. CRS Score</small>
      </div>
      <div className={styles.txt}>{crsNote}</div>
    </div>
  )
}
