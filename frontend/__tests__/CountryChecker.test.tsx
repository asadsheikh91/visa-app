/**
 * __tests__/CountryChecker.test.tsx
 *
 * Tests CountryChecker for:
 *   Phase 5A: q.id filtering/keying, multi_choice arrays, submission payload, errors
 *   Phase 5B: show_if visibility, hidden-question skip, answer cleanup,
 *             required-field inline error, submit payload excludes hidden answers
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { Question, CheckResult } from '../types/visa'

jest.mock('../lib/useVisaApi', () => ({ useVisaApi: jest.fn() }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
// The result phase renders ResultCard, whose report prompt uses these.
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/lib/useReportApi', () => ({ useReportApi: () => ({ generate: jest.fn() }) }))

import { useVisaApi } from '../lib/useVisaApi'
import { CountryChecker } from '../components/checker/CountryChecker'
import { ApiError } from '../lib/api'

const mockGetQuestions  = jest.fn()
const mockCheckReadiness = jest.fn()
const mockStartReadiness = jest.fn()
const stableApi = {
  getQuestions:  mockGetQuestions,
  checkReadiness: mockCheckReadiness,
  startReadiness: mockStartReadiness,
  getCountries:  jest.fn(),
  getHistory:    jest.fn(),
}
;(useVisaApi as jest.Mock).mockReturnValue(stableApi)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeQ(overrides: Partial<Question> = {}): Question {
  return {
    id:               'q_coe',
    question:         'Do you have a CoE?',
    input_type:       'yes_no',
    options:          [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
    required:         true,
    scoring_key:      'cat_core',
    risk_category:    'Critical',
    blocker_possible: true,
    show_if:          null,
    ...overrides,
  }
}

const CLEAN_RESULT: CheckResult = {
  id: 'check-abc',
  visa_type: 'student_visa',
  country: 'australia',
  result: 'Strong Readiness',
  result_description: 'Strong file.',
  score: 90,
  critical_blockers: [],
  high_risk_flags: [],
  soft_warnings: [],
  warnings: [],
  recommendations: ['Great job!'],
  normalized_answers: {},
  sources_used: [],
  required_missing_answers: [],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function renderAndLoad(questions: Question[]) {
  mockGetQuestions.mockResolvedValueOnce({ questions })
  await act(async () => { render(<CountryChecker country="australia" />) })
  await waitFor(() => expect(screen.queryByText(/Loading/)).not.toBeInTheDocument(), { timeout: 3000 })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(useVisaApi as jest.Mock).mockReturnValue(stableApi)
  // Default: opening a session succeeds (funnel tracking) so the checker proceeds.
  mockStartReadiness.mockResolvedValue({ session_id: 'sess-1', remaining: 2, limit: 3 })
})

// ===========================================================================
// Phase 5A — canonical field usage (preserved from previous tests)
// ===========================================================================

describe('CountryChecker — Phase 5A: q.id filtering and keying', () => {
  it('renders a question with q.id set', async () => {
    await renderAndLoad([makeQ({ id: 'aus_has_coe' })])
    expect(screen.getByText('Do you have a CoE?')).toBeInTheDocument()
  })

  it('filters out questions without q.id', async () => {
    const oldQ = { question_id: 'old', question_text: 'Old?', input_type: 'yes_no' } as any
    await renderAndLoad([oldQ, makeQ({ id: 'q_real' })])
    expect(screen.getByText('Do you have a CoE?')).toBeInTheDocument()
    expect(screen.queryByText('Old?')).not.toBeInTheDocument()
  })

  it('submit payload uses q.id as key', async () => {
    mockGetQuestions.mockResolvedValueOnce({ questions: [makeQ({ id: 'aus_coe' })] })
    mockCheckReadiness.mockResolvedValueOnce(CLEAN_RESULT)
    await act(async () => { render(<CountryChecker country="australia" />) })
    await waitFor(() => screen.getByText('Do you have a CoE?'))
    await act(async () => { fireEvent.click(screen.getByText('Yes')) })
    await act(async () => { fireEvent.click(screen.getByText('See results')) })
    await waitFor(() =>
      expect(mockCheckReadiness).toHaveBeenCalledWith(
        'australia',
        expect.objectContaining({ aus_coe: 'yes' }),
        'sess-1'
      )
    )
  })
})

describe('CountryChecker — Phase 5A: multi_choice arrays', () => {
  const multiQ = makeQ({
    id:         'q_ties',
    input_type: 'multi_choice',
    options:    [{ label: 'Family', value: 'family' }, { label: 'Savings', value: 'savings' }],
  })
  const followQ = makeQ({ id: 'q_final', input_type: 'yes_no' })

  it('accumulates multi_choice selections as array in payload', async () => {
    mockGetQuestions.mockResolvedValueOnce({ questions: [multiQ, followQ] })
    mockCheckReadiness.mockResolvedValueOnce(CLEAN_RESULT)
    await act(async () => { render(<CountryChecker country="australia" />) })
    await waitFor(() => screen.getByText('Family'))
    await act(async () => { fireEvent.click(screen.getByText('Family')) })
    await act(async () => { fireEvent.click(screen.getByText('Savings')) })
    await act(async () => { fireEvent.click(screen.getByText('Next')) })
    await waitFor(() => screen.getByText('Do you have a CoE?'))
    await act(async () => { fireEvent.click(screen.getByText('Yes')) })
    await act(async () => { fireEvent.click(screen.getByText('See results')) })
    await waitFor(() => {
      const answers = mockCheckReadiness.mock.calls[0][1]
      expect(Array.isArray(answers['q_ties'])).toBe(true)
      expect(answers['q_ties']).toContain('family')
      expect(answers['q_ties']).toContain('savings')
    })
  })
})

// ===========================================================================
// Phase 5B — show_if visibility
// ===========================================================================

describe('CountryChecker — Phase 5B: show_if visibility', () => {
  it('hides a question whose show_if condition is not met', async () => {
    const parentQ = makeQ({ id: 'q_parent', question: 'Parent question?', required: false })
    const childQ  = makeQ({
      id:       'q_child',
      question: 'Child question?',
      required: false,
      show_if:  { question_id: 'q_parent', operator: 'eq', value: 'yes' },
    })
    await renderAndLoad([parentQ, childQ])
    // Parent shows; child should NOT show because parent unanswered
    expect(screen.getByText('Parent question?')).toBeInTheDocument()
    expect(screen.queryByText('Child question?')).not.toBeInTheDocument()
  })

  it('shows a question once its parent answer satisfies show_if', async () => {
    const parentQ = makeQ({ id: 'q_parent', question: 'Parent question?', required: false })
    const childQ  = makeQ({
      id:       'q_child',
      question: 'Child question?',
      required: false,
      show_if:  { question_id: 'q_parent', operator: 'eq', value: 'yes' },
    })
    await renderAndLoad([parentQ, childQ])

    // Answer parent Yes → advance to next visible question
    await act(async () => { fireEvent.click(screen.getByText('Yes')) })
    await act(async () => { fireEvent.click(screen.getByText('Next')) })

    // Child is now visible
    await waitFor(() =>
      expect(screen.getByText('Child question?')).toBeInTheDocument()
    )
  })

  it('does not show hidden question in navigation count', async () => {
    const parentQ = makeQ({ id: 'q_p', question: 'Parent?', required: false })
    const childQ  = makeQ({
      id:       'q_c',
      question: 'Child?',
      required: false,
      show_if:  { question_id: 'q_p', operator: 'eq', value: 'yes' },
    })
    await renderAndLoad([parentQ, childQ])
    // Total should show only 1 (parent only)
    expect(screen.getByText('Question 1 of 1')).toBeInTheDocument()
  })

  it('updates question count when show_if reveals a question', async () => {
    const parentQ = makeQ({ id: 'q_p', question: 'Parent?', required: false })
    const childQ  = makeQ({
      id:       'q_c',
      question: 'Child?',
      required: false,
      show_if:  { question_id: 'q_p', operator: 'eq', value: 'yes' },
    })
    await renderAndLoad([parentQ, childQ])
    expect(screen.getByText('Question 1 of 1')).toBeInTheDocument()

    // Answer Yes → child appears, total becomes 2
    await act(async () => { fireEvent.click(screen.getByText('Yes')) })
    await waitFor(() => expect(screen.getByText('Question 1 of 2')).toBeInTheDocument())
  })
})

// ===========================================================================
// Phase 5B — required field inline error
// ===========================================================================

describe('CountryChecker — Phase 5B: required field validation', () => {
  it('shows inline error when required question is skipped', async () => {
    const q = makeQ({
      id:            'q_req',
      question:      'Required Q?',
      required:      true,
      error_message: 'You must answer this.',
    })
    await renderAndLoad([q])
    // Click Next without answering
    await act(async () => { fireEvent.click(screen.getByText('See results')) })
    await waitFor(() =>
      expect(screen.getByText('You must answer this.')).toBeInTheDocument()
    )
  })

  it('shows generic required message when error_message is absent', async () => {
    const q = makeQ({ id: 'q_req', question: 'Required Q?', required: true })
    delete (q as any).error_message
    await renderAndLoad([q])
    await act(async () => { fireEvent.click(screen.getByText('See results')) })
    await waitFor(() =>
      expect(screen.getByText(/Please answer this question/i)).toBeInTheDocument()
    )
  })

  it('multi_choice empty array counts as unanswered', async () => {
    const q = makeQ({
      id:            'q_mc',
      question:      'Pick at least one.',
      input_type:    'multi_choice',
      required:      true,
      error_message: 'Select at least one option.',
      options:       [{ label: 'A', value: 'a' }],
    })
    await renderAndLoad([q])
    // Try to submit without selecting anything
    await act(async () => { fireEvent.click(screen.getByText('See results')) })
    await waitFor(() =>
      expect(screen.getByText('Select at least one option.')).toBeInTheDocument()
    )
  })
})

// ===========================================================================
// Phase 5B — hidden required question does not block submit
// ===========================================================================

describe('CountryChecker — Phase 5B: hidden required questions do not block submit', () => {
  it('submits successfully even if a required hidden question is unanswered', async () => {
    const parentQ = makeQ({ id: 'q_parent', question: 'Parent?', required: false })
    const childQ  = makeQ({
      id:            'q_child',
      question:      'Child?',
      required:      true,          // required — but hidden when parent != yes
      error_message: 'Must answer child.',
      show_if:       { question_id: 'q_parent', operator: 'eq', value: 'yes' },
    })
    mockGetQuestions.mockResolvedValueOnce({ questions: [parentQ, childQ] })
    mockCheckReadiness.mockResolvedValueOnce(CLEAN_RESULT)

    await act(async () => { render(<CountryChecker country="australia" />) })
    await waitFor(() => screen.getByText('Parent?'))

    // Answer parent "No" → child stays hidden
    await act(async () => { fireEvent.click(screen.getByText('No')) })
    // Single visible question; try to submit
    await act(async () => { fireEvent.click(screen.getByText('See results')) })

    // Should submit without showing child's error
    await waitFor(() => expect(mockCheckReadiness).toHaveBeenCalled())
    expect(screen.queryByText('Must answer child.')).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Phase 5B — submit payload excludes hidden answers
// ===========================================================================

describe('CountryChecker — Phase 5B: submit payload excludes hidden answers', () => {
  it('does not include answers for hidden questions in the submit payload', async () => {
    const parentQ = makeQ({ id: 'q_parent', question: 'Parent?', required: false })
    const childQ  = makeQ({
      id:       'q_child',
      question: 'Child?',
      required: false,
      show_if:  { question_id: 'q_parent', operator: 'eq', value: 'yes' },
    })
    const followQ = makeQ({ id: 'q_follow', question: 'Follow-up?' })

    mockGetQuestions.mockResolvedValueOnce({ questions: [parentQ, childQ, followQ] })
    mockCheckReadiness.mockResolvedValueOnce(CLEAN_RESULT)

    await act(async () => { render(<CountryChecker country="australia" />) })
    await waitFor(() => screen.getByText('Parent?'))

    // Answer parent Yes → child appears (q_child becomes visible at pos 2)
    await act(async () => { fireEvent.click(screen.getByText('Yes')) })
    await act(async () => { fireEvent.click(screen.getByText('Next')) })
    await waitFor(() => screen.getByText('Child?'))

    // Answer child
    await act(async () => { fireEvent.click(screen.getByText('Yes')) })
    await act(async () => { fireEvent.click(screen.getByText('Next')) })
    await waitFor(() => screen.getByText('Follow-up?'))

    // Now change parent to No in answers by navigating back to parent
    // (simulate changing parent via going back)
    await act(async () => { fireEvent.click(screen.getByText('Back')) })
    await waitFor(() => screen.getByText('Child?'))  // back to child
    await act(async () => { fireEvent.click(screen.getByText('Back')) })
    await waitFor(() => screen.getByText('Parent?'))
    await act(async () => { fireEvent.click(screen.getByText('No')) }) // change parent to No

    // Navigate forward — child is now hidden
    // After clicking Next, we should skip child and go to follow-up
    await act(async () => { fireEvent.click(screen.getByText('Next')) })
    await waitFor(() => screen.getByText('Follow-up?'))

    // Answer follow-up and submit
    await act(async () => { fireEvent.click(screen.getByText('Yes')) })
    await act(async () => { fireEvent.click(screen.getByText('See results')) })

    await waitFor(() => expect(mockCheckReadiness).toHaveBeenCalled())
    const payload = mockCheckReadiness.mock.calls[0][1]
    // q_child should NOT be in payload (it was hidden when parent=no)
    expect(payload).not.toHaveProperty('q_child')
    expect(payload).toHaveProperty('q_parent', 'no')
    expect(payload).toHaveProperty('q_follow', 'yes')
  })

  it('child answer is removed when parent answer changes to hide child', async () => {
    const parentQ = makeQ({ id: 'q_parent', question: 'Parent?', required: false })
    const childQ  = makeQ({
      id:       'q_child',
      question: 'Child?',
      required: false,
      show_if:  { question_id: 'q_parent', operator: 'eq', value: 'yes' },
    })

    mockGetQuestions.mockResolvedValueOnce({ questions: [parentQ, childQ] })
    mockCheckReadiness.mockResolvedValueOnce(CLEAN_RESULT)

    await act(async () => { render(<CountryChecker country="australia" />) })
    await waitFor(() => screen.getByText('Parent?'))

    // Answer Yes → navigate to child → answer Yes
    await act(async () => { fireEvent.click(screen.getByText('Yes')) })
    await act(async () => { fireEvent.click(screen.getByText('Next')) })
    await waitFor(() => screen.getByText('Child?'))
    await act(async () => { fireEvent.click(screen.getByText('Yes')) })

    // Go back and change parent to No
    await act(async () => { fireEvent.click(screen.getByText('Back')) })
    await waitFor(() => screen.getByText('Parent?'))
    await act(async () => { fireEvent.click(screen.getByText('No')) })

    // Submit (only parent visible now)
    await act(async () => { fireEvent.click(screen.getByText('See results')) })
    await waitFor(() => expect(mockCheckReadiness).toHaveBeenCalled())

    const payload = mockCheckReadiness.mock.calls[0][1]
    expect(payload).not.toHaveProperty('q_child')
  })
})

// ===========================================================================
// Phase 5A — error state (preserved)
// ===========================================================================

describe('CountryChecker — error handling', () => {
  it('displays error message when API fails', async () => {
    mockGetQuestions.mockRejectedValueOnce(new ApiError('Service unavailable', 503))
    await act(async () => { render(<CountryChecker country="australia" />) })
    await waitFor(() =>
      expect(screen.getByText('Service unavailable')).toBeInTheDocument()
    , { timeout: 3000 })
  })
})
