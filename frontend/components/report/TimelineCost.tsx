import { Section } from './Section'
import styles from './report.module.css'

export function TimelineCost({
  prepTime,
  costRange,
}: {
  prepTime: string
  costRange: string
}) {
  return (
    <Section num="06" title="Timeline & Cost Expectations">
      <div className={styles.expect}>
        <div className={styles.box}>
          <div className={styles.h}>Est. Preparation Time</div>
          <div className={styles.big}>{prepTime}</div>
          <p>
            To reach a competitive, submission-ready profile from your current
            standing.
          </p>
        </div>
        <div className={styles.box}>
          <div className={styles.h}>Indicative Government &amp; Third-Party Costs</div>
          <div className={styles.big}>{costRange}</div>
          <p>
            Approximate total for assessments, tests, biometrics, and application
            fees. Confirm current fees on official sources.
          </p>
        </div>
      </div>
    </Section>
  )
}
