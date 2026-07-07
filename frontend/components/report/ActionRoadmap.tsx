import type { RoadmapPhase } from '@/types/report'
import { Section } from './Section'
import styles from './report.module.css'

export function ActionRoadmap({ roadmap }: { roadmap: RoadmapPhase[] }) {
  return (
    <Section num="04" title="Recommended Action Roadmap">
      {roadmap.map((phase) => (
        <div className={styles.phase} key={phase.window}>
          <div className={styles.when}>
            {phase.window}
            <small>{phase.theme}</small>
          </div>
          <ul>
            {phase.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  )
}
