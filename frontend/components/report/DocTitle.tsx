import styles from './report.module.css'

export function DocTitle() {
  return (
    <div className={styles.doctitle}>
      <div className={styles.eyebrow}>Confidential Assessment</div>
      <h2>Visa Readiness Report</h2>
      <p>
        An independent, criteria-based assessment of your current standing against
        published eligibility and selection requirements for your chosen
        immigration pathway.
      </p>
    </div>
  )
}
