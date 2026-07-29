// Hero report-card sample data — a fabricated illustrative file, not a real
// applicant. Kept out of Hero.tsx so score/line-items can be revised without
// touching motion/layout code.

export type ReportLineStatus = 'pass' | 'warn' | 'fail'

export interface ReportLine {
  doc: string
  detail: string
  status: ReportLineStatus
}

export const SAMPLE_REPORT = {
  applicant: 'Asad Sheikh',
  fileRows: [
    ['Route', 'Pakistan → United Kingdom'],
    ['Program', 'MSc Computer Science'],
    ['Intake', 'September 2026'],
  ] as [string, string][],
  score: 61,
  badge: 'AT RISK · 3 CRITICAL GAPS',
  formNumber: 'PV-2026-0193',
  // Assessment date on the corner stamp. A fixed PAST date, never new Date():
  //   - fixed, because a live date would re-stamp this sample every morning and
  //     break the fiction that it is one real prior assessment;
  //   - past, because the previous value (12 Aug 2026) sat in the future, and a
  //     sample document dated after today reads as careless on a product whose
  //     whole pitch is accuracy.
  // May 2026 reads correctly against the sample's own September 2026 intake:
  // early enough that the 28-day financial hold flagged below is still fixable.
  assessedDate: 'PV · 04 May 2026',
  lines: [
    { doc: 'Financial evidence', detail: '28-day rule not met', status: 'fail' },
    { doc: 'Course progression', detail: '2-year gap unexplained', status: 'fail' },
    { doc: 'CAS + offer letter', detail: 'On file', status: 'pass' },
    { doc: 'TB certificate', detail: 'Missing', status: 'fail' },
    { doc: 'Sponsor relationship', detail: 'Evidence thin', status: 'warn' },
  ] as ReportLine[],
} as const
