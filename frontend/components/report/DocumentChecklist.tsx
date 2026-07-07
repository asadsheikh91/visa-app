import type { DocumentItem } from '@/types/report'
import { Section } from './Section'
import styles from './report.module.css'

const STAT_CLASS: Record<DocumentItem['status'], string> = {
  ready: styles.statReady,
  pending: styles.statPending,
  missing: styles.statMissing,
}

export function DocumentChecklist({ documents }: { documents: DocumentItem[] }) {
  if (documents.length === 0) return null
  return (
    <Section num="05" title="Document Checklist">
      <table className={styles.docs}>
        <thead>
          <tr>
            <th>Document</th>
            <th>Purpose</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d, i) => (
            <tr key={`${d.name}-${i}`}>
              <td className={styles.doc}>{d.name}</td>
              <td>{d.purpose}</td>
              <td>
                <span className={`${styles.stat} ${STAT_CLASS[d.status]}`}>
                  {d.statusLabel}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}
