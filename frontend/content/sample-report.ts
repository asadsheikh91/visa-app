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
  applicant: 'Ayesha R.',
  fileRows: [
    ['Route', 'Pakistan → United Kingdom'],
    ['Program', 'MSc Computer Science'],
    ['Intake', 'September 2026'],
  ] as [string, string][],
  score: 61,
  badge: 'AT RISK · 3 CRITICAL GAPS',
  formNumber: 'PV-2026-0193',
  lines: [
    { doc: 'Financial evidence', detail: '28-day rule not met', status: 'fail' },
    { doc: 'Course progression', detail: '2-year gap unexplained', status: 'fail' },
    { doc: 'CAS + offer letter', detail: 'On file', status: 'pass' },
    { doc: 'TB certificate', detail: 'Missing', status: 'fail' },
    { doc: 'Sponsor relationship', detail: 'Evidence thin', status: 'warn' },
  ] as ReportLine[],
} as const
