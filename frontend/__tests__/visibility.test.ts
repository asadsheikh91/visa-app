/**
 * __tests__/visibility.test.ts
 *
 * Unit tests for lib/visibility.ts
 * All tests run without React — pure function evaluation.
 */

import { evaluateShowIf, isQuestionVisible, getVisibleQuestions, pruneHiddenAnswers } from '../lib/visibility'
import type { Question, ShowIf, AnswerValue } from '../types/visa'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ANSWERS: Record<string, AnswerValue> = {
  q_parent: 'yes',
  q_multi:  ['family_ties', 'savings'],
}

function makeQ(overrides: Partial<Question> = {}): Question {
  return {
    id:               'q_test',
    question:         'Test?',
    input_type:       'yes_no',
    required:         true,
    scoring_key:      'cat',
    risk_category:    'High',
    blocker_possible: false,
    show_if:          null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// evaluateShowIf — null / undefined
// ---------------------------------------------------------------------------

describe('evaluateShowIf — null/undefined', () => {
  it('returns true for null show_if', () => {
    expect(evaluateShowIf(null, {})).toBe(true)
  })
  it('returns true for undefined show_if', () => {
    expect(evaluateShowIf(undefined, {})).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// evaluateShowIf — eq
// ---------------------------------------------------------------------------

describe('evaluateShowIf — eq', () => {
  const cond: ShowIf = { question_id: 'q_parent', operator: 'eq', value: 'yes' }

  it('returns true when answer equals value', () => {
    expect(evaluateShowIf(cond, { q_parent: 'yes' })).toBe(true)
  })
  it('returns false when answer does not match', () => {
    expect(evaluateShowIf(cond, { q_parent: 'no' })).toBe(false)
  })
  it('returns false when answer is missing', () => {
    expect(evaluateShowIf(cond, {})).toBe(false)
  })
  it('is case-insensitive', () => {
    expect(evaluateShowIf(cond, { q_parent: 'YES' })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// evaluateShowIf — neq
// ---------------------------------------------------------------------------

describe('evaluateShowIf — neq', () => {
  const cond: ShowIf = { question_id: 'q_parent', operator: 'neq', value: 'no' }

  it('returns true when answer differs from value', () => {
    expect(evaluateShowIf(cond, { q_parent: 'yes' })).toBe(true)
  })
  it('returns false when answer equals value', () => {
    expect(evaluateShowIf(cond, { q_parent: 'no' })).toBe(false)
  })
  it('returns false when answer is missing (conservative)', () => {
    expect(evaluateShowIf(cond, {})).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// evaluateShowIf — in
// ---------------------------------------------------------------------------

describe('evaluateShowIf — in', () => {
  const cond: ShowIf = { question_id: 'q_parent', operator: 'in', value: ['yes', 'not_applicable'] }

  it('returns true when answer is in the list', () => {
    expect(evaluateShowIf(cond, { q_parent: 'yes' })).toBe(true)
    expect(evaluateShowIf(cond, { q_parent: 'not_applicable' })).toBe(true)
  })
  it('returns false when answer is not in the list', () => {
    expect(evaluateShowIf(cond, { q_parent: 'no' })).toBe(false)
  })
  it('returns false when answer is missing', () => {
    expect(evaluateShowIf(cond, {})).toBe(false)
  })
  it('is case-insensitive', () => {
    expect(evaluateShowIf(cond, { q_parent: 'YES' })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// evaluateShowIf — not_in
// ---------------------------------------------------------------------------

describe('evaluateShowIf — not_in', () => {
  const cond: ShowIf = { question_id: 'q_parent', operator: 'not_in', value: ['no', 'unknown'] }

  it('returns true when answer is NOT in the list', () => {
    expect(evaluateShowIf(cond, { q_parent: 'yes' })).toBe(true)
  })
  it('returns false when answer IS in the list', () => {
    expect(evaluateShowIf(cond, { q_parent: 'no' })).toBe(false)
    expect(evaluateShowIf(cond, { q_parent: 'unknown' })).toBe(false)
  })
  it('returns false when answer is missing (conservative)', () => {
    expect(evaluateShowIf(cond, {})).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// evaluateShowIf — multi_contains
// ---------------------------------------------------------------------------

describe('evaluateShowIf — multi_contains', () => {
  const cond: ShowIf = { question_id: 'q_multi', operator: 'multi_contains', value: 'family_ties' }

  it('returns true when array answer contains value', () => {
    expect(evaluateShowIf(cond, { q_multi: ['family_ties', 'savings'] })).toBe(true)
  })
  it('returns false when array answer does not contain value', () => {
    expect(evaluateShowIf(cond, { q_multi: ['savings'] })).toBe(false)
  })
  it('returns false when answer is missing', () => {
    expect(evaluateShowIf(cond, {})).toBe(false)
  })
  it('returns false for empty array', () => {
    expect(evaluateShowIf(cond, { q_multi: [] })).toBe(false)
  })
  it('handles comma-separated string answer', () => {
    expect(evaluateShowIf(cond, { q_multi: 'family_ties,savings' })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// evaluateShowIf — and
// ---------------------------------------------------------------------------

describe('evaluateShowIf — and', () => {
  const cond: ShowIf = {
    operator: 'and',
    conditions: [
      { question_id: 'q1', operator: 'eq', value: 'yes' },
      { question_id: 'q2', operator: 'eq', value: 'yes' },
    ],
  }

  it('returns true when all nested conditions pass', () => {
    expect(evaluateShowIf(cond, { q1: 'yes', q2: 'yes' })).toBe(true)
  })
  it('returns false when any nested condition fails', () => {
    expect(evaluateShowIf(cond, { q1: 'yes', q2: 'no' })).toBe(false)
    expect(evaluateShowIf(cond, { q1: 'no',  q2: 'yes' })).toBe(false)
  })
  it('returns false when all conditions fail', () => {
    expect(evaluateShowIf(cond, { q1: 'no', q2: 'no' })).toBe(false)
  })
  it('returns false for empty conditions array', () => {
    const empty: ShowIf = { operator: 'and', conditions: [] }
    expect(evaluateShowIf(empty, {})).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// evaluateShowIf — or
// ---------------------------------------------------------------------------

describe('evaluateShowIf — or', () => {
  const cond: ShowIf = {
    operator: 'or',
    conditions: [
      { question_id: 'q1', operator: 'eq', value: 'yes' },
      { question_id: 'q2', operator: 'eq', value: 'yes' },
    ],
  }

  it('returns true when at least one nested condition passes', () => {
    expect(evaluateShowIf(cond, { q1: 'no',  q2: 'yes' })).toBe(true)
    expect(evaluateShowIf(cond, { q1: 'yes', q2: 'no'  })).toBe(true)
  })
  it('returns false when no nested condition passes', () => {
    expect(evaluateShowIf(cond, { q1: 'no', q2: 'no' })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// evaluateShowIf — safety / malformed
// ---------------------------------------------------------------------------

describe('evaluateShowIf — safety / malformed', () => {
  it('returns false for non-object condition', () => {
    expect(evaluateShowIf('eq:yes' as unknown as ShowIf, {})).toBe(false)
  })
  it('returns false for array condition', () => {
    expect(evaluateShowIf(['eq', 'yes'] as unknown as ShowIf, {})).toBe(false)
  })
  it('returns false for unknown operator', () => {
    const bad: ShowIf = { question_id: 'q1', operator: 'invented_op' as any, value: 'yes' }
    expect(evaluateShowIf(bad, { q1: 'yes' })).toBe(false)
  })
  it('returns false for in-condition with non-array value', () => {
    const bad: ShowIf = { question_id: 'q1', operator: 'in', value: 'yes' as any }
    expect(evaluateShowIf(bad, { q1: 'yes' })).toBe(false)
  })
  it('missing parent answer does not show dependent question (eq)', () => {
    const cond: ShowIf = { question_id: 'no_such_q', operator: 'eq', value: 'yes' }
    expect(evaluateShowIf(cond, {})).toBe(false)
  })
  it('missing parent answer does not show dependent question (in)', () => {
    const cond: ShowIf = { question_id: 'no_such_q', operator: 'in', value: ['yes'] }
    expect(evaluateShowIf(cond, {})).toBe(false)
  })
  it('does not throw on deeply nested malformed conditions', () => {
    const bad: ShowIf = {
      operator: 'and',
      conditions: [
        null as unknown as ShowIf,
        { question_id: 'q1', operator: 'eq', value: 'yes' },
      ],
    }
    expect(() => evaluateShowIf(bad, { q1: 'yes' })).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// isQuestionVisible
// ---------------------------------------------------------------------------

describe('isQuestionVisible', () => {
  it('returns true when show_if is null', () => {
    expect(isQuestionVisible(makeQ({ show_if: null }), {})).toBe(true)
  })
  it('returns true when show_if is undefined', () => {
    const q = makeQ()
    delete (q as any).show_if
    expect(isQuestionVisible(q, {})).toBe(true)
  })
  it('returns false when show_if condition is not met', () => {
    const q = makeQ({
      show_if: { question_id: 'q_parent', operator: 'eq', value: 'yes' },
    })
    expect(isQuestionVisible(q, { q_parent: 'no' })).toBe(false)
  })
  it('returns true when show_if condition is met', () => {
    const q = makeQ({
      show_if: { question_id: 'q_parent', operator: 'eq', value: 'yes' },
    })
    expect(isQuestionVisible(q, { q_parent: 'yes' })).toBe(true)
  })
  it('never throws — returns false for malformed show_if', () => {
    const q = makeQ({ show_if: 'bad_string' as unknown as ShowIf })
    expect(() => isQuestionVisible(q, {})).not.toThrow()
    expect(isQuestionVisible(q, {})).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getVisibleQuestions
// ---------------------------------------------------------------------------

describe('getVisibleQuestions', () => {
  it('returns all questions when none have show_if', () => {
    const qs = [makeQ({ id: 'q1' }), makeQ({ id: 'q2' })]
    expect(getVisibleQuestions(qs, {}).length).toBe(2)
  })

  it('filters out questions whose show_if is not met', () => {
    const qs = [
      makeQ({ id: 'q_parent', show_if: null }),
      makeQ({ id: 'q_child',  show_if: { question_id: 'q_parent', operator: 'eq', value: 'yes' } }),
    ]
    const visible = getVisibleQuestions(qs, { q_parent: 'no' })
    expect(visible.map((q) => q.id)).toEqual(['q_parent'])
  })

  it('includes questions once parent answer meets show_if', () => {
    const qs = [
      makeQ({ id: 'q_parent', show_if: null }),
      makeQ({ id: 'q_child',  show_if: { question_id: 'q_parent', operator: 'eq', value: 'yes' } }),
    ]
    const visible = getVisibleQuestions(qs, { q_parent: 'yes' })
    expect(visible.map((q) => q.id)).toEqual(['q_parent', 'q_child'])
  })
})

// ---------------------------------------------------------------------------
// pruneHiddenAnswers
// ---------------------------------------------------------------------------

describe('pruneHiddenAnswers', () => {
  const qs = [
    makeQ({ id: 'q_parent', show_if: null }),
    makeQ({ id: 'q_child',  show_if: { question_id: 'q_parent', operator: 'eq', value: 'yes' } }),
  ]

  it('keeps answers for visible questions', () => {
    const answers = { q_parent: 'yes', q_child: 'no' }
    const pruned = pruneHiddenAnswers(qs, answers)
    expect(pruned).toHaveProperty('q_parent', 'yes')
    expect(pruned).toHaveProperty('q_child', 'no')
  })

  it('removes answers for hidden questions', () => {
    // q_parent = 'no' means q_child is hidden
    const answers = { q_parent: 'no', q_child: 'yes' }
    const pruned = pruneHiddenAnswers(qs, answers)
    expect(pruned).toHaveProperty('q_parent', 'no')
    expect(pruned).not.toHaveProperty('q_child')
  })

  it('does not mutate the original answers object', () => {
    const answers = { q_parent: 'no', q_child: 'yes' }
    pruneHiddenAnswers(qs, answers)
    expect(answers).toHaveProperty('q_child')  // original unchanged
  })
})
