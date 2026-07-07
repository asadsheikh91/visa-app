import type { ReactNode } from 'react'
import type { CriterionScore } from '@/types/report'
import { Section } from './Section'
import styles from './report.module.css'

const FILL: Record<CriterionScore['fill'], string> = {
  pass: styles.fillPass,
  warn: styles.fillWarn,
  crit: styles.fillCrit,
}

/**
 * Section 02. Renders the per-criterion bars; `children` (the CRS callout) is
 * placed inside the same section, matching the sample layout.
 */
export function ScoreBreakdown({
  criteria,
  children,
}: {
  criteria: CriterionScore[]
  children?: ReactNode
}) {
  return (
    <Section num="02" title="Score Breakdown by Criterion">
      <div className={styles.cats}>
        {criteria.map((c) => (
          <div className={styles.cat} key={c.key}>
            <div className={styles.label}>
              {c.label}
              {c.sublabel ? <small>{c.sublabel}</small> : null}
            </div>
            <div className={styles.bar}>
              <i
                className={FILL[c.fill]}
                style={{ width: `${Math.max(0, Math.min(100, c.score))}%` }}
              />
            </div>
            <div className={styles.pct}>{Math.round(c.score)}</div>
          </div>
        ))}
      </div>
      {children}
    </Section>
  )
}
