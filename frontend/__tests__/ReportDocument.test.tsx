import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { ReportDocument } from '@/components/report/ReportDocument'
import { CrsCallout } from '@/components/report/CrsCallout'
import { parseReportData } from '@/lib/reportSchema'
import type { ReportData } from '@/types/report'

const MOCK: ReportData = {
  reportId: 'PV-CA-2026-0417',
  issuedAt: '03 Jul 2026',
  dataCurrentAs: 'Jun 2026',
  applicant: {
    name: 'Ahmed Raza Khan',
    targetCountry: 'Canada',
    pathway: 'Student Visa',
    occupationNoc: 'Masters',
    assessmentDate: '03 Jul 2026',
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
  verdictLead: 'You have a viable pathway, but you are not yet competitive.',
  crsNote: '',
  criteria: [
    { key: 'finance', label: 'Proof of Funds', sublabel: 'Settlement funds', score: 35, fill: 'crit' },
    { key: 'lang', label: 'Language Proficiency', sublabel: 'Against CLB', score: 48, fill: 'crit' },
  ],
  estCrs: null,
  findings: [
    {
      id: 'critical:q_funds',
      severity: 'critical',
      title: 'Proof of funds below required threshold',
      category: 'Funds',
      explanation: 'Your declared funds are short.',
      impact: 'Insufficient funds is a common ground for refusal.',
      fixSteps: ['Confirm the required amount.', 'Consolidate funds.'],
      bestPractices: ['Keep bank letters.'],
      source: { title: 'IRCC — Proof of funds', url: 'https://www.canada.ca/funds', retrievedAt: 'Jun 2026' },
    },
  ],
  roadmap: [{ window: '0–2 Months', theme: 'Foundations', items: ['Start your ECA'] }],
  documents: [
    { name: 'Proof of funds (bank letters)', purpose: 'Settlement requirement', status: 'missing', statusLabel: 'Not started' },
  ],
  prepTime: '5–8 months',
  costRange: 'See official fee schedules',
  sources: [{ title: 'IRCC — Student permit', url: 'https://www.canada.ca/study', retrievedAt: 'Jan 2025' }],
  templateVersion: 'verdict-v1',
  promptVersion: 'narrate-v1',
}

describe('ReportDocument', () => {
  it('renders the applicant, verdict and band from data', () => {
    render(<ReportDocument data={MOCK} />)
    expect(screen.getByText('Ahmed Raza Khan')).toBeInTheDocument()
    expect(screen.getByText('Conditional')).toBeInTheDocument()
    expect(
      screen.getByText(/you have a viable pathway, but you are not yet competitive/i),
    ).toBeInTheDocument()
  })

  it('renders criteria labels and the finding', () => {
    render(<ReportDocument data={MOCK} />)
    expect(screen.getByText('Proof of Funds')).toBeInTheDocument()
    expect(screen.getByText('Language Proficiency')).toBeInTheDocument()
    expect(screen.getByText('Proof of funds below required threshold')).toBeInTheDocument()
    expect(screen.getByText('Your declared funds are short.')).toBeInTheDocument()
    expect(screen.getByText('Confirm the required amount.')).toBeInTheDocument()
  })

  it('renders roadmap, checklist status label and sources', () => {
    render(<ReportDocument data={MOCK} />)
    expect(screen.getByText('Start your ECA')).toBeInTheDocument()
    expect(screen.getByText('Not started')).toBeInTheDocument()
    expect(screen.getByText(/IRCC — Student permit/)).toBeInTheDocument()
  })

  it('omits the CRS callout when estCrs is null', () => {
    render(<ReportDocument data={MOCK} />)
    expect(screen.queryByText('Est. CRS Score')).not.toBeInTheDocument()
  })
})

describe('CrsCallout', () => {
  it('renders nothing when estCrs is null', () => {
    const { container } = render(<CrsCallout estCrs={null} crsNote="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the estimate and note when present', () => {
    render(<CrsCallout estCrs={412} crsNote="Recent draws invited from the low-500s." />)
    expect(screen.getByText('Est. CRS Score')).toBeInTheDocument()
    expect(screen.getByText(/~412/)).toBeInTheDocument()
    expect(screen.getByText(/low-500s/)).toBeInTheDocument()
  })
})

describe('parseReportData (Zod boundary)', () => {
  it('accepts a well-formed payload', () => {
    expect(() => parseReportData(MOCK)).not.toThrow()
  })

  it('rejects a payload missing a required field', () => {
    const broken = { ...MOCK } as Record<string, unknown>
    delete broken.verdictLead
    expect(() => parseReportData(broken)).toThrow()
  })

  it('rejects a bad document status enum', () => {
    const broken = {
      ...MOCK,
      documents: [{ name: 'x', purpose: 'y', status: 'bogus', statusLabel: 'X' }],
    }
    expect(() => parseReportData(broken)).toThrow()
  })
})
