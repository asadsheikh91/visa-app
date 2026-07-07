import type { Finding } from '@/types/report'
import { Section } from './Section'
import { FindingCard } from './FindingCard'
import styles from './report.module.css'

export function FindingsSection({ findings }: { findings: Finding[] }) {
  return (
    <Section num="03" title="Detailed Findings & Fixes">
      {findings.length === 0 ? (
        <p className={styles.lead}>
          No blocking findings were flagged on the criteria assessed. Review the
          document checklist and roadmap below before you submit.
        </p>
      ) : (
        findings.map((f) => <FindingCard key={f.id} finding={f} />)
      )}
    </Section>
  )
}
