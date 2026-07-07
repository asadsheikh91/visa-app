import type { Finding } from '@/types/report'
import styles from './report.module.css'

const SEV_CLASS: Record<Finding['severity'], string> = {
  critical: styles.sevCrit,
  high: styles.sevHigh,
  medium: styles.sevMed,
}

const SEV_LABEL: Record<Finding['severity'], string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
}

export function FindingCard({ finding }: { finding: Finding }) {
  const { severity, title, category, explanation, impact, fixSteps, bestPractices, source } =
    finding
  return (
    <div className={styles.finding}>
      <div className={styles.findingHead}>
        <span className={`${styles.sev} ${SEV_CLASS[severity]}`}>{SEV_LABEL[severity]}</span>
        <span className={styles.ftitle}>{title}</span>
        <span className={styles.fcat}>{category}</span>
      </div>
      <div className={styles.findingBody}>
        <div className={styles.fblock}>
          <div className={styles.h}>What we found</div>
          <p>{explanation}</p>
        </div>
        {impact ? (
          <div className={styles.fblock}>
            <div className={styles.h}>Why it matters</div>
            <p>{impact}</p>
          </div>
        ) : null}
        <div className={`${styles.fblock} ${styles.fix}`}>
          <div className={styles.h}>How to fix it</div>
          {fixSteps.length > 0 ? (
            <ol className={styles.steps}>
              {fixSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          ) : null}
          {bestPractices.length > 0 ? (
            <ul className={styles.steps}>
              {bestPractices.map((bp, i) => (
                <li key={i}>{bp}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className={styles.source}>
          <b>Source:</b> {source.title}
          {source.url ? ` (${source.url})` : ''}
          {source.retrievedAt ? `. Retrieved ${source.retrievedAt}.` : ''}
        </div>
      </div>
    </div>
  )
}
