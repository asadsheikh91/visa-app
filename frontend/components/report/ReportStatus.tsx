import styles from './report.module.css'

/** Shared loading / error shell for the report routes (kept visually neutral). */
export function ReportStatus({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className={styles.report}>
      <div className={styles.page}>
        <div className={styles.pad}>
          <h2 style={{ fontFamily: "'Source Serif 4', serif", margin: 0 }}>{title}</h2>
          {detail ? (
            <p style={{ color: 'var(--ink-soft)', marginTop: 8 }}>{detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
