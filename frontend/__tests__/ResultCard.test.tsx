/**
 * __tests__/ResultCard.test.tsx
 *
 * Tests that ResultCard:
 *   - Renders critical_blockers, high_risk_flags, soft_warnings, warnings, recommendations
 *   - Does not crash when optional arrays are missing or empty
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ResultCard } from '../components/checker/ResultCard'
import type { CheckResult } from '../types/visa'

// ---------------------------------------------------------------------------
// Mock next/link
// ---------------------------------------------------------------------------

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'abc-123',
    visa_type: 'student_visa',
    country: 'australia',
    result: 'Strong Readiness',
    result_description: 'Your application looks strong.',
    score: 90,
    critical_blockers: [],
    high_risk_flags: [],
    soft_warnings: [],
    warnings: [],
    recommendations: [],
    normalized_answers: {},
    sources_used: [],
    required_missing_answers: [],
    ...overrides,
  }
}

function renderResult(result: CheckResult) {
  return render(<ResultCard result={result} onRetry={jest.fn()} />)
}

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe('ResultCard — score and description', () => {
  it('renders the score result label', () => {
    renderResult(makeResult())
    expect(screen.getByText('Strong Readiness')).toBeInTheDocument()
  })

  it('renders the result description', () => {
    renderResult(makeResult())
    expect(screen.getByText('Your application looks strong.')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Critical blockers
// ---------------------------------------------------------------------------

describe('ResultCard — critical_blockers', () => {
  it('renders critical blockers section when present', () => {
    renderResult(makeResult({
      score: 0,
      result: 'Critical Refusal Risk',
      critical_blockers: [
        { question_id: 'q_coe', message: 'You need a CoE.', rule: 'CoE Required' },
      ],
    }))
    expect(screen.getByText('Critical Blockers (1)')).toBeInTheDocument()
    expect(screen.getByText('You need a CoE.')).toBeInTheDocument()
  })

  it('does not render blockers section when empty', () => {
    renderResult(makeResult({ critical_blockers: [] }))
    expect(screen.queryByText(/Critical Blockers/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// High-risk flags
// ---------------------------------------------------------------------------

describe('ResultCard — high_risk_flags', () => {
  it('renders high-risk flags section when present', () => {
    renderResult(makeResult({
      high_risk_flags: [
        { question_id: 'q_funds', message: 'Insufficient evidence of funds.', rule: 'Financial Capacity' },
      ],
    }))
    expect(screen.getByText('High-Risk Flags (1)')).toBeInTheDocument()
    expect(screen.getByText('Insufficient evidence of funds.')).toBeInTheDocument()
  })

  it('does not render high-risk flags section when empty', () => {
    renderResult(makeResult({ high_risk_flags: [] }))
    expect(screen.queryByText(/High-Risk Flags/)).not.toBeInTheDocument()
  })

  it('renders multiple high-risk flags', () => {
    renderResult(makeResult({
      high_risk_flags: [
        { question_id: 'q1', message: 'Flag one.' },
        { question_id: 'q2', message: 'Flag two.' },
      ],
    }))
    expect(screen.getByText('High-Risk Flags (2)')).toBeInTheDocument()
    expect(screen.getByText('Flag one.')).toBeInTheDocument()
    expect(screen.getByText('Flag two.')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Soft warnings
// ---------------------------------------------------------------------------

describe('ResultCard — soft_warnings', () => {
  it('renders advisory notices section when present', () => {
    renderResult(makeResult({
      soft_warnings: [
        { question_id: 'q_gs', message: 'Strengthen your genuine student evidence.' },
      ],
    }))
    expect(screen.getByText('Advisory Notices (1)')).toBeInTheDocument()
    expect(screen.getByText('Strengthen your genuine student evidence.')).toBeInTheDocument()
  })

  it('does not render advisory notices section when empty', () => {
    renderResult(makeResult({ soft_warnings: [] }))
    expect(screen.queryByText(/Advisory Notices/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Warnings (auto-computed backward-compat)
// ---------------------------------------------------------------------------

describe('ResultCard — warnings', () => {
  it('renders warnings section when present', () => {
    renderResult(makeResult({
      warnings: [
        { question_id: 'q_misc', message: 'Address this before applying.' },
      ],
    }))
    expect(screen.getByText('Warnings (1)')).toBeInTheDocument()
    expect(screen.getByText('Address this before applying.')).toBeInTheDocument()
  })

  it('does not render warnings section when empty', () => {
    renderResult(makeResult({ warnings: [] }))
    expect(screen.queryByText(/^Warnings/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

describe('ResultCard — recommendations', () => {
  it('renders recommendations', () => {
    renderResult(makeResult({
      recommendations: ['Fix the CoE issue.', 'Consult an agent.'],
    }))
    expect(screen.getByText('Recommendations (2)')).toBeInTheDocument()
    expect(screen.getByText('Fix the CoE issue.')).toBeInTheDocument()
    expect(screen.getByText('Consult an agent.')).toBeInTheDocument()
  })

  it('does not render recommendations section when empty', () => {
    renderResult(makeResult({ recommendations: [] }))
    expect(screen.queryByText(/Recommendations/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Null / missing field safety
// ---------------------------------------------------------------------------

describe('ResultCard — does not crash on missing optional arrays', () => {
  it('handles undefined critical_blockers gracefully', () => {
    const result = makeResult()
    // Simulate old API response with missing field
    ;(result as unknown as Record<string, unknown>).critical_blockers = undefined
    expect(() => renderResult(result)).not.toThrow()
  })

  it('handles undefined high_risk_flags gracefully', () => {
    const result = makeResult()
    ;(result as unknown as Record<string, unknown>).high_risk_flags = undefined
    expect(() => renderResult(result)).not.toThrow()
  })

  it('handles undefined soft_warnings gracefully', () => {
    const result = makeResult()
    ;(result as unknown as Record<string, unknown>).soft_warnings = undefined
    expect(() => renderResult(result)).not.toThrow()
  })

  it('handles undefined warnings gracefully', () => {
    const result = makeResult()
    ;(result as unknown as Record<string, unknown>).warnings = undefined
    expect(() => renderResult(result)).not.toThrow()
  })

  it('handles undefined recommendations gracefully', () => {
    const result = makeResult()
    ;(result as unknown as Record<string, unknown>).recommendations = undefined
    expect(() => renderResult(result)).not.toThrow()
  })

  it('does not render [object Object] anywhere', () => {
    renderResult(makeResult({
      high_risk_flags: [{ question_id: 'q1', message: 'Risk.' }],
      soft_warnings:   [{ question_id: 'q2', message: 'Warning.' }],
    }))
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Unsaved check notification
// ---------------------------------------------------------------------------

describe('ResultCard — unsaved check banner', () => {
  it('shows unsaved notice when id is null', () => {
    renderResult(makeResult({ id: null }))
    expect(screen.getByText(/not saved to your dashboard/)).toBeInTheDocument()
  })

  it('does not show unsaved notice when id is present', () => {
    renderResult(makeResult({ id: 'abc-123' }))
    expect(screen.queryByText(/not saved to your dashboard/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Sources / citations (Phase 5D)
// ---------------------------------------------------------------------------

describe('ResultCard — sources_used', () => {
  it('does not render sources section when sources_used is empty', () => {
    renderResult(makeResult({ sources_used: [] }))
    expect(screen.queryByText(/Official Sources/)).not.toBeInTheDocument()
  })

  it('renders sources section heading when sources are present', () => {
    renderResult(makeResult({
      sources_used: [
        { source_url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' },
      ],
    }))
    expect(screen.getByText(/Official Sources \(1\)/)).toBeInTheDocument()
  })

  it('renders source URL as an external link', () => {
    renderResult(makeResult({
      sources_used: [
        { source_url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' },
      ],
    }))
    const link = screen.getByRole('link', { name: /immi\.homeaffairs\.gov\.au/ })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute(
      'href',
      'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500'
    )
  })

  it('renders source link with target="_blank"', () => {
    renderResult(makeResult({
      sources_used: [
        { source_url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' },
      ],
    }))
    const link = screen.getByRole('link', { name: /immi\.homeaffairs\.gov\.au/ })
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders source link with rel="noopener noreferrer"', () => {
    renderResult(makeResult({
      sources_used: [
        { source_url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' },
      ],
    }))
    const link = screen.getByRole('link', { name: /immi\.homeaffairs\.gov\.au/ })
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('uses resolved name as link text when provided', () => {
    renderResult(makeResult({
      sources_used: [
        {
          source_url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500',
          name: 'Student Visa (subclass 500) — Home Affairs',
        },
      ],
    }))
    expect(
      screen.getByRole('link', { name: /Student Visa \(subclass 500\) — Home Affairs/ })
    ).toBeInTheDocument()
  })

  it('uses title as link text when name is absent', () => {
    renderResult(makeResult({
      sources_used: [
        {
          source_url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500',
          title: 'Student 500 Info Page',
        },
      ],
    }))
    expect(
      screen.getByRole('link', { name: /Student 500 Info Page/ })
    ).toBeInTheDocument()
  })

  it('falls back to URL text when no name or title', () => {
    renderResult(makeResult({
      sources_used: [
        { source_url: 'https://example.gov/visa' },
      ],
    }))
    // URL is used as link text when no name/title is resolved
    expect(screen.getByRole('link', { name: /example\.gov\/visa/ })).toBeInTheDocument()
  })

  it('renders source_ids as text when no source_url', () => {
    renderResult(makeResult({
      sources_used: [
        { source_ids: ['AUS_STUDENT_500_MAIN', 'AUS_CRICOS_CHECK'] },
      ],
    }))
    expect(
      screen.getByText(/Source IDs: AUS_STUDENT_500_MAIN, AUS_CRICOS_CHECK/)
    ).toBeInTheDocument()
  })

  it('renders both URL link and source IDs inline when both present', () => {
    renderResult(makeResult({
      sources_used: [
        {
          source_url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500',
          source_ids: ['AUS_500_MAIN'],
        },
      ],
    }))
    // URL is used as link text (no name/title given); source IDs appear inline
    expect(screen.getByRole('link', { name: /immi\.homeaffairs\.gov\.au/ })).toBeInTheDocument()
    expect(screen.getByText(/\(ID: AUS_500_MAIN\)/)).toBeInTheDocument()
  })

  it('never renders [object Object] for source entries', () => {
    renderResult(makeResult({
      sources_used: [
        { source_url: 'https://example.gov/a', name: 'Page A' },
        { source_ids: ['ID_B'] },
      ],
    }))
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
  })

  it('deduplicates sources with the same URL', () => {
    renderResult(makeResult({
      sources_used: [
        { source_url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' },
        { source_url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' },
        { source_url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500' },
      ],
    }))
    // Only 1 "Official source 1" should appear (deduplicated), not 3
    expect(screen.getByText(/Official Sources \(1\)/)).toBeInTheDocument()
    // URL is link text — one deduplicated entry
    const links = screen.getAllByRole('link', { name: /immi\.homeaffairs\.gov\.au/ })
    expect(links).toHaveLength(1)
  })

  it('renders multiple distinct sources', () => {
    renderResult(makeResult({
      sources_used: [
        { source_url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500', name: 'DHA Student 500' },
        { source_url: 'https://cricos.education.gov.au', name: 'CRICOS Register' },
      ],
    }))
    expect(screen.getByText(/Official Sources \(2\)/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /DHA Student 500/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /CRICOS Register/ })).toBeInTheDocument()
  })

  it('does not crash when sources_used is undefined', () => {
    const result = makeResult()
    ;(result as unknown as Record<string, unknown>).sources_used = undefined
    expect(() => renderResult(result)).not.toThrow()
    expect(screen.queryByText(/Official Sources/)).not.toBeInTheDocument()
  })
})
