/**
 * __tests__/QuestionCard.test.tsx
 *
 * Tests for QuestionCard component.
 * Verifies canonical field rendering and all supported input types.
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuestionCard } from '../components/checker/QuestionCard'
import type { Question } from '../types/visa'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQ(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q_test',
    question: 'Do you have a CoE?',
    help_text: 'A CoE is required from a registered provider.',
    input_type: 'yes_no',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
    required: true,
    scoring_key: 'cat_core',
    risk_category: 'Critical',
    blocker_possible: true,
    ...overrides,
  }
}

function renderCard(q: Question, answer?: string | string[], onAnswer = jest.fn()) {
  return render(
    <QuestionCard
      question={q}
      answer={answer}
      onAnswer={onAnswer}
      questionNumber={1}
      totalQuestions={5}
    />
  )
}

// ---------------------------------------------------------------------------
// Canonical field rendering
// ---------------------------------------------------------------------------

describe('QuestionCard — canonical fields', () => {
  it('renders question.question as the heading', () => {
    renderCard(makeQ())
    expect(screen.getByText('Do you have a CoE?')).toBeInTheDocument()
  })

  it('renders help_text when present', () => {
    renderCard(makeQ())
    expect(screen.getByText('A CoE is required from a registered provider.')).toBeInTheDocument()
  })

  it('does not render a help_text block when help_text is absent', () => {
    const q = makeQ({ help_text: undefined })
    renderCard(q)
    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument()
    // help block text absent
    expect(screen.queryByText(/registered provider/)).not.toBeInTheDocument()
  })

  it('shows question number and total', () => {
    renderCard(makeQ())
    expect(screen.getByText('Question 1 of 5')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// yes_no
// ---------------------------------------------------------------------------

describe('QuestionCard — yes_no', () => {
  it('renders exactly two buttons: Yes and No', () => {
    renderCard(makeQ({ input_type: 'yes_no' }))
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('calls onAnswer("yes") when Yes is clicked', () => {
    const onAnswer = jest.fn()
    renderCard(makeQ({ input_type: 'yes_no' }), undefined, onAnswer)
    fireEvent.click(screen.getByText('Yes'))
    expect(onAnswer).toHaveBeenCalledWith('yes')
  })

  it('calls onAnswer("no") when No is clicked', () => {
    const onAnswer = jest.fn()
    renderCard(makeQ({ input_type: 'yes_no' }), undefined, onAnswer)
    fireEvent.click(screen.getByText('No'))
    expect(onAnswer).toHaveBeenCalledWith('no')
  })

  it('marks the selected button as pressed', () => {
    renderCard(makeQ({ input_type: 'yes_no' }), 'yes')
    const yesBtn = screen.getByText('Yes').closest('button')!
    expect(yesBtn).toHaveAttribute('aria-pressed', 'true')
  })
})

// ---------------------------------------------------------------------------
// yes_no_unknown
// ---------------------------------------------------------------------------

describe('QuestionCard — yes_no_unknown', () => {
  it('renders Yes, No, and Not sure', () => {
    renderCard(makeQ({ input_type: 'yes_no_unknown', options: [] }))
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
    expect(screen.getByText('Not sure')).toBeInTheDocument()
  })

  it('calls onAnswer("unknown") when Not sure is clicked', () => {
    const onAnswer = jest.fn()
    renderCard(makeQ({ input_type: 'yes_no_unknown', options: [] }), undefined, onAnswer)
    fireEvent.click(screen.getByText('Not sure'))
    expect(onAnswer).toHaveBeenCalledWith('unknown')
  })
})

// ---------------------------------------------------------------------------
// single_choice
// ---------------------------------------------------------------------------

describe('QuestionCard — single_choice', () => {
  const opts = [
    { label: 'London',         value: 'london' },
    { label: 'Outside London', value: 'outside_london' },
  ]

  it('renders option labels (not values)', () => {
    renderCard(makeQ({ input_type: 'single_choice', options: opts }))
    expect(screen.getByText('London')).toBeInTheDocument()
    expect(screen.getByText('Outside London')).toBeInTheDocument()
    // Raw values must NOT appear in accessible text
    expect(screen.queryByText('outside_london')).not.toBeInTheDocument()
  })

  it('calls onAnswer with option.value (not option.label)', () => {
    const onAnswer = jest.fn()
    renderCard(makeQ({ input_type: 'single_choice', options: opts }), undefined, onAnswer)
    fireEvent.click(screen.getByText('Outside London'))
    expect(onAnswer).toHaveBeenCalledWith('outside_london')
    expect(onAnswer).not.toHaveBeenCalledWith('Outside London')
  })

  it('marks the matching option as pressed', () => {
    renderCard(makeQ({ input_type: 'single_choice', options: opts }), 'london')
    const londonBtn = screen.getByText('London').closest('button')!
    expect(londonBtn).toHaveAttribute('aria-pressed', 'true')
    const outerBtn = screen.getByText('Outside London').closest('button')!
    expect(outerBtn).toHaveAttribute('aria-pressed', 'false')
  })
})

// ---------------------------------------------------------------------------
// multi_choice
// ---------------------------------------------------------------------------

describe('QuestionCard — multi_choice', () => {
  const opts = [
    { label: 'Family Ties',  value: 'family_ties' },
    { label: 'Savings',      value: 'savings' },
    { label: 'Property',     value: 'property' },
  ]

  it('renders all option labels', () => {
    renderCard(makeQ({ input_type: 'multi_choice', options: opts }))
    expect(screen.getByText('Family Ties')).toBeInTheDocument()
    expect(screen.getByText('Savings')).toBeInTheDocument()
    expect(screen.getByText('Property')).toBeInTheDocument()
  })

  it('calls onAnswer with individual option.value when clicked', () => {
    const onAnswer = jest.fn()
    renderCard(makeQ({ input_type: 'multi_choice', options: opts }), [], onAnswer)
    fireEvent.click(screen.getByText('Family Ties'))
    expect(onAnswer).toHaveBeenCalledWith('family_ties')
  })

  it('marks checked items using aria-checked', () => {
    renderCard(makeQ({ input_type: 'multi_choice', options: opts }), ['family_ties', 'savings'])
    const familyBtn = screen.getByText('Family Ties').closest('button')!
    expect(familyBtn).toHaveAttribute('aria-checked', 'true')
    const propertyBtn = screen.getByText('Property').closest('button')!
    expect(propertyBtn).toHaveAttribute('aria-checked', 'false')
  })

  it('does not show [object Object] for any option', () => {
    renderCard(makeQ({ input_type: 'multi_choice', options: opts }))
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// currency_amount
// ---------------------------------------------------------------------------

describe('QuestionCard — currency_amount', () => {
  it('renders a numeric input', () => {
    renderCard(makeQ({ input_type: 'currency_amount', options: [] }))
    const input = screen.getByRole('spinbutton')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'number')
  })

  it('calls onAnswer with the typed numeric string', () => {
    const onAnswer = jest.fn()
    renderCard(makeQ({ input_type: 'currency_amount', options: [] }), undefined, onAnswer)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '50000' } })
    expect(onAnswer).toHaveBeenCalledWith('50000')
  })
})

// ---------------------------------------------------------------------------
// number
// ---------------------------------------------------------------------------

describe('QuestionCard — number', () => {
  it('renders a numeric input', () => {
    renderCard(makeQ({ input_type: 'number', options: [] }))
    expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number')
  })
})

// ---------------------------------------------------------------------------
// date
// ---------------------------------------------------------------------------

describe('QuestionCard — date', () => {
  it('renders a date input', () => {
    renderCard(makeQ({ input_type: 'date', options: [] }))
    const input = screen.getByLabelText('Date')
    expect(input).toHaveAttribute('type', 'date')
  })

  it('calls onAnswer with the date string', () => {
    const onAnswer = jest.fn()
    renderCard(makeQ({ input_type: 'date', options: [] }), undefined, onAnswer)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2025-09-01' } })
    expect(onAnswer).toHaveBeenCalledWith('2025-09-01')
  })
})

// ---------------------------------------------------------------------------
// text
// ---------------------------------------------------------------------------

describe('QuestionCard — text', () => {
  it('renders a text input', () => {
    renderCard(makeQ({ input_type: 'text', options: [] }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('calls onAnswer with trimmed input value', () => {
    const onAnswer = jest.fn()
    renderCard(makeQ({ input_type: 'text', options: [] }), undefined, onAnswer)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Cambridge' } })
    expect(onAnswer).toHaveBeenCalledWith('Cambridge')
  })
})
