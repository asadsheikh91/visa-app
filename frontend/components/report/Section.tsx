import type { ReactNode } from 'react'
import styles from './report.module.css'

/** Numbered section header (NN · Title · rule) used across the report. */
export function Section({
  num,
  title,
  children,
}: {
  num: string
  title: string
  children: ReactNode
}) {
  return (
    <section className={styles.section}>
      <div className={styles.secHead}>
        <span className={styles.secNum}>{num}</span>
        <h3>{title}</h3>
        <span className={styles.rule} />
      </div>
      {children}
    </section>
  )
}
