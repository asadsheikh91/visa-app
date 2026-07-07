import type { Applicant } from '@/types/report'
import styles from './report.module.css'

// age === 0 is the "unknown" sentinel the builder emits when the student profile
// has no age field; render it (and any blank field) as an em dash.
function show(value: string | number): string {
  if (value === 0 || value === '' || value == null) return '—'
  return String(value)
}

export function ApplicantPanel({ applicant }: { applicant: Applicant }) {
  const fields: [string, string][] = [
    ['Target Country', show(applicant.targetCountry)],
    ['Pathway', show(applicant.pathway)],
    ['Programme / Level', show(applicant.occupationNoc)],
    ['Assessment Date', show(applicant.assessmentDate)],
    ['Age', applicant.age ? `${applicant.age} years` : '—'],
    ['Marital Status', show(applicant.maritalStatus)],
    ['Dependants', show(applicant.dependants)],
    ['Report Version', 'v1.0'],
  ]
  return (
    <div className={styles.applicant}>
      <div className={styles.applicantHead}>
        <div className={styles.name}>{show(applicant.name)}</div>
        <div className={styles.pathway}>{applicant.pathway.toUpperCase()}</div>
      </div>
      <div className={styles.applicantGrid}>
        {fields.map(([k, v]) => (
          <div className={styles.field} key={k}>
            <div className={styles.k}>{k}</div>
            <div className={styles.v}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
