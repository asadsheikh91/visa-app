import type { ScoreBand } from '@/types/report'
import { Section } from './Section'
import styles from './report.module.css'

const SEG = [styles.seg1, styles.seg2, styles.seg3, styles.seg4]

export function ReadinessVerdict({
  overallScore,
  band,
  bandPositionPct,
  bands,
  verdictLead,
}: {
  overallScore: number
  band: string
  bandPositionPct: number
  bands: ScoreBand[]
  verdictLead: string
}) {
  const pos = Math.max(0, Math.min(100, bandPositionPct))
  return (
    <Section num="01" title="Overall Readiness">
      <div className={styles.verdict}>
        <div className={styles.scoreDial}>
          <div className={styles.num}>
            {Math.round(overallScore)}
            <small>/100</small>
          </div>
          <div className={styles.bandPill}>{band}</div>
        </div>
        <div className={styles.verdictBody}>
          <p className={styles.lead}>{verdictLead}</p>
          <div className={styles.meter}>
            <div className={styles.marker}>
              <i style={{ left: `${pos}%` }}>{Math.round(overallScore)}</i>
            </div>
            <div className={styles.meterTrack}>
              {bands.map((b, i) => (
                <span key={b.label} className={SEG[Math.min(i, SEG.length - 1)]} />
              ))}
            </div>
            <div className={styles.meterLabels}>
              {bands.map((b) => (
                <span
                  key={b.label}
                  className={b.label === band ? styles.active : undefined}
                >
                  {b.label}
                  <br />
                  {b.min}–{b.max}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}
