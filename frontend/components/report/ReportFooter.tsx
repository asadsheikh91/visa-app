import styles from './report.module.css'

export function ReportFooter({ reportId }: { reportId: string }) {
  return (
    <footer className={styles.footer}>
      <div>
        <b>ParchiVisa</b> · parchivisa.app
      </div>
      <div>{reportId} · Confidential</div>
    </footer>
  )
}
