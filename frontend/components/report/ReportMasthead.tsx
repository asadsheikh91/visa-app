import styles from './report.module.css'

export function ReportMasthead({
  reportId,
  issuedAt,
  dataCurrentAs,
}: {
  reportId: string
  issuedAt: string
  dataCurrentAs: string
}) {
  return (
    <div className={styles.masthead}>
      <div className={styles.brand}>
        <div className={styles.mark}>PV</div>
        <div>
          <div className={styles.wordmark}>PARCHIVISA</div>
          <div className={styles.tag}>Visa Readiness Intelligence</div>
        </div>
      </div>
      <div className={styles.meta}>
        Report&nbsp;ID&nbsp; <b>{reportId}</b>
        <br />
        Issued&nbsp; <b>{issuedAt}</b>
        <br />
        Data current as of&nbsp; <b>{dataCurrentAs}</b>
      </div>
    </div>
  )
}
