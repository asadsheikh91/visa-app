import type { Source } from '@/types/report'
import { Section } from './Section'
import styles from './report.module.css'

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function SourcesReferences({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null
  return (
    <Section num="07" title="Sources & References">
      <ul className={styles.refs}>
        {sources.map((s, i) => (
          <li key={`${s.url}-${i}`}>
            {s.title}
            {s.url ? <span className={styles.refDomain}> {domain(s.url)}</span> : null}
          </li>
        ))}
      </ul>
    </Section>
  )
}
