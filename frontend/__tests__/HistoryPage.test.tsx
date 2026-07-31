/**
 * __tests__/HistoryPage.test.tsx
 *
 * Tests for:
 *   HistoryResultCard — item-level rendering: country, score, band,
 *     critical_blockers, high_risk_flags, soft_warnings, warnings,
 *     recommendations, normalized_answers, sources_used,
 *     null-safe behaviour, array answer formatting.
 *   DashboardContent — page-level states: loading, empty, error.
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { HistoryItem } from '../types/visa'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn(() => ({ user: { firstName: 'Asad' } })),
  useAuth: jest.fn(() => ({ getToken: async () => 'test-token' })),
}))

jest.mock('../lib/useVisaApi', () => ({ useVisaApi: jest.fn() }))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

// PreviousChecks now renders GenerateReportButton, which uses the app router.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}))

// AuthGate — render children directly in tests (no auth enforcement)
jest.mock('../components/auth/AuthGate', () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { useVisaApi } from '../lib/useVisaApi'
import { HistoryResultCard } from '../components/checker/HistoryResultCard'
import { PreviousChecks } from '../components/dashboard/PreviousChecks'

// ---------------------------------------------------------------------------
// Shared mock api
// ---------------------------------------------------------------------------

const mockGetHistory = jest.fn()
const stableApi = {
  getHistory:    mockGetHistory,
  getCountries:  jest.fn(),
  getQuestions:  jest.fn(),
  checkReadiness: jest.fn(),
}
;(useVisaApi as jest.Mock).mockReturnValue(stableApi)

beforeEach(() => {
  jest.clearAllMocks()
  ;(useVisaApi as jest.Mock).mockReturnValue(stableApi)
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id:                 'hist-001',
    country:            'australia',
    visa_type:          'student_visa',
    score:              75,
    result:             'Mostly Ready',
    result_description: 'Your file looks solid but has some gaps.',
    critical_blockers:  [],
    high_risk_flags:    [],
    soft_warnings:      [],
    warnings:           [],
    recommendations:    [],
    normalized_answers: {},
    sources_used:       [],
    created_at:         '2026-05-01T10:00:00Z',
    ...overrides,
  }
}

// Helper: render a card and click "Details" to expand it
async function renderAndExpand(item: HistoryItem) {
  render(<HistoryResultCard item={item} />)
  const btn = screen.getByText('Details')
  await act(async () => { fireEvent.click(btn) })
}

// ===========================================================================
// HistoryResultCard — summary row
// ===========================================================================

describe('HistoryResultCard — summary row', () => {
  it('renders country name', () => {
    render(<HistoryResultCard item={makeItem()} />)
    expect(screen.getByText('Australia')).toBeInTheDocument()
  })

  it('renders score', () => {
    render(<HistoryResultCard item={makeItem({ score: 75 })} />)
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('renders result band', () => {
    render(<HistoryResultCard item={makeItem({ result: 'Mostly Ready' })} />)
    expect(screen.getByText('Mostly Ready')).toBeInTheDocument()
  })

  it('renders formatted date', () => {
    render(<HistoryResultCard item={makeItem({ created_at: '2026-05-01T10:00:00Z' })} />)
    // en-GB format: "1 May 2026"
    expect(screen.getByText(/1 May 2026/)).toBeInTheDocument()
  })

  it('does not show Details button when item has no details', () => {
    render(<HistoryResultCard item={makeItem()} />)
    expect(screen.queryByText('Details')).not.toBeInTheDocument()
  })

  it('shows Details button when item has blockers', () => {
    render(
      <HistoryResultCard
        item={makeItem({
          critical_blockers: [{ question_id: 'q1', message: 'Missing CoE' }],
        })}
      />
    )
    expect(screen.getByText('Details')).toBeInTheDocument()
  })
})

// ===========================================================================
// HistoryResultCard — null / undefined safety
// ===========================================================================

describe('HistoryResultCard — null/undefined safety', () => {
  it('does not crash when all array fields are undefined', () => {
    const item = makeItem()
    // Force undefined on all array fields — simulating older DB rows
    ;(item as unknown as Record<string, unknown>).critical_blockers  = undefined
    ;(item as unknown as Record<string, unknown>).high_risk_flags    = undefined
    ;(item as unknown as Record<string, unknown>).soft_warnings      = undefined
    ;(item as unknown as Record<string, unknown>).warnings           = undefined
    ;(item as unknown as Record<string, unknown>).recommendations    = undefined
    ;(item as unknown as Record<string, unknown>).normalized_answers = undefined
    ;(item as unknown as Record<string, unknown>).sources_used       = undefined

    expect(() => render(<HistoryResultCard item={item} />)).not.toThrow()
    expect(screen.getByText('Australia')).toBeInTheDocument()
  })
})

// ===========================================================================
// HistoryResultCard — expanded detail panel
// ===========================================================================

describe('HistoryResultCard — critical_blockers', () => {
  it('renders critical blockers after expanding', async () => {
    const item = makeItem({
      critical_blockers: [
        { question_id: 'q_coe', message: 'You must have a valid CoE.' },
        { question_id: 'q_funds', message: 'Insufficient funds demonstrated.' },
      ],
    })
    await renderAndExpand(item)
    expect(screen.getByText('You must have a valid CoE.')).toBeInTheDocument()
    expect(screen.getByText('Insufficient funds demonstrated.')).toBeInTheDocument()
    expect(screen.getByText(/Critical Blockers \(2\)/)).toBeInTheDocument()
  })
})

describe('HistoryResultCard — high_risk_flags', () => {
  it('renders high-risk flags after expanding', async () => {
    const item = makeItem({
      high_risk_flags: [
        { question_id: 'q_gap', message: 'Study gap exceeds 2 years.' },
      ],
    })
    await renderAndExpand(item)
    expect(screen.getByText('Study gap exceeds 2 years.')).toBeInTheDocument()
    expect(screen.getByText(/High-Risk Flags \(1\)/)).toBeInTheDocument()
  })
})

describe('HistoryResultCard — soft_warnings', () => {
  it('renders advisory notices after expanding', async () => {
    const item = makeItem({
      soft_warnings: [
        { question_id: 'q_eng', message: 'English test expiring soon.' },
      ],
    })
    await renderAndExpand(item)
    expect(screen.getByText('English test expiring soon.')).toBeInTheDocument()
    expect(screen.getByText(/Advisory Notices \(1\)/)).toBeInTheDocument()
  })
})

describe('HistoryResultCard — recommendations', () => {
  it('renders recommendations after expanding', async () => {
    const item = makeItem({
      recommendations: ['Book your IELTS re-sit.', 'Get a bank statement certified.'],
    })
    await renderAndExpand(item)
    expect(screen.getByText('Book your IELTS re-sit.')).toBeInTheDocument()
    expect(screen.getByText('Get a bank statement certified.')).toBeInTheDocument()
    expect(screen.getByText(/Recommendations \(2\)/)).toBeInTheDocument()
  })
})

describe('HistoryResultCard — normalized_answers', () => {
  it('renders key/value pairs after expanding and opening answers toggle', async () => {
    const item = makeItem({
      normalized_answers: { has_coe: 'yes', english_test: 'IELTS' },
    })
    await renderAndExpand(item)

    // Click "Submitted Answers" toggle
    const answersBtn = screen.getByText('Submitted Answers')
    await act(async () => { fireEvent.click(answersBtn) })

    expect(screen.getByText('has_coe')).toBeInTheDocument()
    expect(screen.getByText('yes')).toBeInTheDocument()
    expect(screen.getByText('english_test')).toBeInTheDocument()
    expect(screen.getByText('IELTS')).toBeInTheDocument()
  })

  it('renders array answers as comma-separated values', async () => {
    const item = makeItem({
      normalized_answers: { ties: ['family', 'savings', 'property'] },
    })
    await renderAndExpand(item)

    const answersBtn = screen.getByText('Submitted Answers')
    await act(async () => { fireEvent.click(answersBtn) })

    // Array should render as "family, savings, property" not "[object Object]"
    expect(screen.getByText('family, savings, property')).toBeInTheDocument()
  })

  it('shows empty snapshot message when normalized_answers is empty', async () => {
    const item = makeItem({
      // Need at least one other detail field so Details button appears
      recommendations: ['Do X'],
      normalized_answers: {},
    })
    await renderAndExpand(item)

    const answersBtn = screen.getByText('Submitted Answers')
    await act(async () => { fireEvent.click(answersBtn) })

    expect(
      screen.getByText('No submitted answer snapshot available.')
    ).toBeInTheDocument()
  })
})

describe('HistoryResultCard — sources_used', () => {
  it('renders source URL as a link when source_url is present', async () => {
    const item = makeItem({
      sources_used: [
        { source_url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' },
      ],
    })
    await renderAndExpand(item)

    const link = screen.getByRole('link', {
      name: /immi\.homeaffairs\.gov\.au/,
    })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute(
      'href',
      'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500'
    )
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders source IDs as text when no source_url', async () => {
    const item = makeItem({
      sources_used: [
        { source_ids: ['AUS_STUDENT_500_MAIN', 'AUS_CRICOS_CHECK'] },
      ],
    })
    await renderAndExpand(item)

    expect(
      screen.getByText(/Source IDs: AUS_STUDENT_500_MAIN, AUS_CRICOS_CHECK/)
    ).toBeInTheDocument()
  })
})

// ===========================================================================
// PreviousChecks — dashboard history section (presentational)
// ===========================================================================

const noop = () => {}

function renderPrevious(props: Partial<React.ComponentProps<typeof PreviousChecks>> = {}) {
  return render(
    <PreviousChecks
      checks={[]}
      loading={false}
      error={null}
      onRetry={noop}
      onBuildFile={noop}
      {...props}
    />
  )
}

describe('PreviousChecks — loading state', () => {
  it('shows loading spinner while loading', () => {
    renderPrevious({ loading: true })
    expect(screen.getByText('Loading your checks…')).toBeInTheDocument()
  })
})

describe('PreviousChecks — empty state', () => {
  it('shows empty state message when no checks exist', () => {
    renderPrevious({ checks: [] })
    // Heading and prompt are separate elements, so match them separately.
    expect(screen.getByText(/No checks yet/i)).toBeInTheDocument()
    expect(screen.getByText(/run your first/i)).toBeInTheDocument()
  })
})

describe('PreviousChecks — error state', () => {
  it('shows error message when an error is passed', () => {
    renderPrevious({ error: 'History service unavailable' })
    expect(screen.getByText('History service unavailable')).toBeInTheDocument()
  })

  it('shows a Try again control on error', () => {
    renderPrevious({ error: 'Something broke' })
    expect(screen.getByText('Try again')).toBeInTheDocument()
  })
})

describe('PreviousChecks — history list', () => {
  it('renders a history item with country, score and result', () => {
    renderPrevious({
      checks: [makeItem({ country: 'uk', score: 90, result: 'Strong Readiness' })],
    })
    expect(screen.getByText('United Kingdom')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('Strong Readiness')).toBeInTheDocument()
  })

  it('offers "Build file from this check" for an inactive check', () => {
    renderPrevious({
      checks: [makeItem({ id: 'chk-1', country: 'uk' })],
      activeCheckId: null,
    })
    expect(screen.getByText('Build file from this check')).toBeInTheDocument()
  })

  it('marks the active check instead of offering to build it', () => {
    renderPrevious({
      checks: [makeItem({ id: 'chk-active', country: 'uk' })],
      activeCheckId: 'chk-active',
    })
    expect(screen.getByText('Active file')).toBeInTheDocument()
    expect(screen.queryByText('Build file from this check')).not.toBeInTheDocument()
  })
})
