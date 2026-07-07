import type { ReportData } from '@/types/report'

/**
 * A realistic sample ReportData for the dev-only design preview (/report/preview)
 * and for manual visual checks. NOT used in production code paths — real reports
 * come from the backend. Mirrors a student-visa assessment (estCrs is null, so the
 * CRS callout is intentionally absent).
 */
export const SAMPLE_REPORT: ReportData = {
  reportId: 'PV-CA-2026-0417',
  issuedAt: '06 Jul 2026',
  dataCurrentAs: 'Jan 2025',
  applicant: {
    name: 'Ahmed Raza Khan',
    targetCountry: 'Canada',
    pathway: 'Student Visa',
    occupationNoc: 'Masters',
    assessmentDate: '06 Jul 2026',
    age: 0,
    maritalStatus: 'Not provided',
    dependants: 'None',
  },
  overallScore: 62,
  band: 'Conditional',
  bandPositionPct: 62,
  bands: [
    { label: 'Not Ready', min: 0, max: 39 },
    { label: 'Conditional', min: 40, max: 64 },
    { label: 'Ready', min: 65, max: 84 },
    { label: 'Highly Competitive', min: 85, max: 100 },
  ],
  verdictLead:
    'You have a viable pathway, but you are not yet competitive. Two critical gaps must be closed before you submit — they currently place you below the standard recent applications are held to.',
  crsNote: '',
  criteria: [
    { key: 'eligibility', label: 'Eligibility & Pathway Match', sublabel: 'Do you qualify to apply', score: 95, fill: 'pass' },
    { key: 'finance', label: 'Proof of Funds', sublabel: 'Settlement funds requirement', score: 35, fill: 'crit' },
    { key: 'language', label: 'Language Proficiency', sublabel: 'Against competitive band', score: 48, fill: 'crit' },
    { key: 'docs', label: 'Documentation Readiness', sublabel: 'Supporting evidence gathered', score: 52, fill: 'warn' },
  ],
  estCrs: null,
  findings: [
    {
      id: 'critical:q_funds',
      severity: 'critical',
      title: 'Proof of funds below required threshold',
      category: 'Funds',
      explanation:
        'Your declared settlement funds are below the minimum commonly required for a single applicant. This was flagged from the answers you provided against the published requirements for your chosen route.',
      impact:
        'Insufficient or improperly documented funds is one of the most common grounds for refusal. Funds must be genuinely available and evidenced by letters from your financial institutions.',
      fixSteps: [
        'Confirm the current required amount for your circumstances on the official source before you apply.',
        'Maintain the balance for the period the guidance expects to see documented.',
        'Obtain bank letters in the exact format the official guidance specifies.',
      ],
      bestPractices: [
        'Keep a dated copy of every document and the official page you relied on.',
      ],
      source: {
        title: 'Immigration, Refugees and Citizenship Canada (IRCC)',
        url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html',
        retrievedAt: 'Jan 2025',
      },
    },
    {
      id: 'critical:q_language',
      severity: 'critical',
      title: 'Language score below competitive band',
      category: 'Language',
      explanation:
        'Your current result maps to below the competitive band. You meet minimum eligibility but are short of the level that strengthens your profile.',
      impact:
        'Language is a major lever on a student profile. Reaching the higher band removes an avoidable weakness reviewers commonly scrutinise.',
      fixSteps: [
        'Identify the exact score the guidance asks for on an approved test.',
        'Prioritise your weakest ability first.',
        'Re-test only once practice results are consistently at or above the required level.',
      ],
      bestPractices: ['Verify the requirement against the official source before you act — thresholds change.'],
      source: {
        title: 'Immigration, Refugees and Citizenship Canada (IRCC)',
        url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html',
        retrievedAt: 'Jan 2025',
      },
    },
    {
      id: 'medium:q_docs',
      severity: 'medium',
      title: 'Supporting documents not yet complete',
      category: 'Documentation',
      explanation:
        'Some supporting documents for your route are not yet gathered. This was flagged from the answers you provided.',
      impact:
        'It will not usually decide the outcome by itself, but resolving it strengthens your file and removes an avoidable weakness.',
      fixSteps: [
        'List every supporting document the official checklist requires for your route.',
        'Gather each item in the format and validity window the guidance states.',
      ],
      bestPractices: ['Keep a dated copy of every document and the official page you relied on.'],
      source: {
        title: 'Immigration, Refugees and Citizenship Canada (IRCC)',
        url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html',
        retrievedAt: 'Jan 2025',
      },
    },
  ],
  roadmap: [
    {
      window: '0–2 Months',
      theme: 'Foundations',
      items: ['Proof of funds below required threshold', 'Language score below competitive band'],
    },
    { window: '2–5 Months', theme: 'Close the gaps', items: ['Strengthen supporting evidence where it is thin.'] },
    {
      window: '5–8 Months',
      theme: 'Prepare to submit',
      items: ['Supporting documents not yet complete', 'Assemble your full document set and re-verify every requirement.'],
    },
  ],
  documents: [
    { name: 'Proof of funds below required threshold', purpose: 'Funds', status: 'missing', statusLabel: 'Not started' },
    { name: 'Language score below competitive band', purpose: 'Language', status: 'missing', statusLabel: 'Not started' },
    { name: 'Supporting documents not yet complete', purpose: 'Documentation', status: 'pending', statusLabel: 'Review' },
  ],
  prepTime: '5–8 months',
  costRange: 'See official fee schedules',
  sources: [
    {
      title: 'Immigration, Refugees and Citizenship Canada (IRCC) — Study permit',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html',
      retrievedAt: 'Jan 2025',
    },
    {
      title: 'IRCC — Proof of funds requirement (2024 update)',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/news/2023/12/international-students-to-benefit-from-modernized-system.html',
      retrievedAt: 'Jan 2024',
    },
  ],
  templateVersion: 'verdict-v1',
  promptVersion: 'narrate-v1',
}
