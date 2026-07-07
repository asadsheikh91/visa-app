import type { ReportData } from '@/types/report'
import { ReportMasthead } from './ReportMasthead'
import { DocTitle } from './DocTitle'
import { ApplicantPanel } from './ApplicantPanel'
import { ReadinessVerdict } from './ReadinessVerdict'
import { ScoreBreakdown } from './ScoreBreakdown'
import { CrsCallout } from './CrsCallout'
import { FindingsSection } from './FindingsSection'
import { ActionRoadmap } from './ActionRoadmap'
import { DocumentChecklist } from './DocumentChecklist'
import { TimelineCost } from './TimelineCost'
import { SourcesReferences } from './SourcesReferences'
import { Disclaimer } from './Disclaimer'
import { ReportFooter } from './ReportFooter'
import styles from './report.module.css'

/**
 * The single, canonical report template. Rendered as-is on screen (/report/[token])
 * and by the print route (/report/[token]/print) that Playwright turns into a PDF —
 * there is no second template. Pure/presentational: it consumes one validated
 * ReportData and renders every section.
 */
export function ReportDocument({ data }: { data: ReportData }) {
  return (
    <div className={styles.report}>
      <div className={styles.page}>
        <div className={styles.pad}>
          <ReportMasthead
            reportId={data.reportId}
            issuedAt={data.issuedAt}
            dataCurrentAs={data.dataCurrentAs}
          />
          <DocTitle />
          <ApplicantPanel applicant={data.applicant} />

          <ReadinessVerdict
            overallScore={data.overallScore}
            band={data.band}
            bandPositionPct={data.bandPositionPct}
            bands={data.bands}
            verdictLead={data.verdictLead}
          />

          <ScoreBreakdown criteria={data.criteria}>
            <CrsCallout estCrs={data.estCrs} crsNote={data.crsNote} />
          </ScoreBreakdown>

          <FindingsSection findings={data.findings} />
          <ActionRoadmap roadmap={data.roadmap} />
          <DocumentChecklist documents={data.documents} />
          <TimelineCost prepTime={data.prepTime} costRange={data.costRange} />
          <SourcesReferences sources={data.sources} />

          <Disclaimer />
          <ReportFooter reportId={data.reportId} />
        </div>
      </div>
    </div>
  )
}
