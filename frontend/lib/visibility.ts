/**
 * lib/visibility.ts
 *
 * Evaluates show_if conditions to determine whether a question should
 * be visible given the current set of answers.
 *
 * Mirrors the backend logic in:
 *   visa_data_service.py  _evaluate_show_if()
 *
 * Design rules:
 *   - null/undefined show_if  → always visible (true)
 *   - Malformed condition     → false (hidden), never throws
 *   - Missing parent answer   → false for eq/in/multi_contains;
 *                               conservatively false for neq/not_in too,
 *                               because showing a dependent question when
 *                               the parent has not been answered yet is
 *                               almost always confusing UX.
 */

import type { Question, AnswerValue, ShowIf } from '@/types/visa'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toStr(v: unknown): string {
  return String(v ?? '').trim().toLowerCase()
}

function toList(answer: AnswerValue | undefined): string[] {
  if (answer === undefined || answer === null) return []
  if (Array.isArray(answer)) return answer.map((v) => String(v).trim().toLowerCase())
  const s = String(answer).trim()
  if (!s) return []
  if (s.includes(',')) return s.split(',').map((x) => x.trim().toLowerCase())
  return [s.toLowerCase()]
}

// ---------------------------------------------------------------------------
// Core evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluates a single ShowIf condition tree against the current answers.
 * Returns true if the condition is satisfied (question should be shown).
 * Never throws — malformed conditions yield false.
 */
export function evaluateShowIf(
  condition: ShowIf | null | undefined,
  answers: Record<string, AnswerValue>,
): boolean {
  // null / undefined → always visible
  if (condition == null) return true

  if (typeof condition !== 'object' || Array.isArray(condition)) return false

  const op = (condition as unknown as Record<string, unknown>).operator as string | undefined

  // ── Compound: and / or ───────────────────────────────────────────────────
  if (op === 'and' || op === 'or') {
    const conds = (condition as unknown as Record<string, unknown>).conditions
    if (!Array.isArray(conds) || conds.length === 0) return false
    if (op === 'and') return conds.every((c) => evaluateShowIf(c as ShowIf, answers))
    return conds.some((c) => evaluateShowIf(c as ShowIf, answers))
  }

  // ── Simple: requires question_id ─────────────────────────────────────────
  const simple = condition as unknown as Record<string, unknown>
  const qid    = simple.question_id as string | undefined
  if (!qid || typeof qid !== 'string') return false

  const raw    = answers[qid]
  const answer = raw !== undefined && raw !== null ? raw : undefined
  const value  = simple.value

  switch (op) {
    case 'eq': {
      if (answer === undefined) return false
      return toStr(answer) === toStr(value)
    }

    case 'neq': {
      // Treat missing answer as NOT matching — so neq is false when parent unanswered.
      // Rationale: a "show if NOT X" question should only appear once the user
      // has actively answered the parent and chosen something other than X.
      if (answer === undefined) return false
      return toStr(answer) !== toStr(value)
    }

    case 'in': {
      if (answer === undefined) return false
      if (!Array.isArray(value)) return false
      const set = new Set(value.map((v) => toStr(v)))
      return set.has(toStr(answer))
    }

    case 'not_in': {
      if (answer === undefined) return false
      if (!Array.isArray(value)) return false
      const set = new Set(value.map((v) => toStr(v)))
      return !set.has(toStr(answer))
    }

    case 'multi_contains': {
      if (answer === undefined) return false
      const items = toList(answer)
      if (items.length === 0) return false
      return items.includes(toStr(value))
    }

    default:
      // Unknown operator — conservatively hide
      return false
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true when the question should be displayed to the user.
 * A question is visible when its show_if condition evaluates to true
 * (or when it has no show_if condition at all).
 */
export function isQuestionVisible(
  question: Question,
  answers: Record<string, AnswerValue>,
): boolean {
  try {
    return evaluateShowIf(question.show_if ?? null, answers)
  } catch {
    // Defensive: any unexpected error → hide the question rather than crash
    return false
  }
}

/**
 * Given the full question list and current answers, returns only the
 * questions that should be shown to the user.
 */
export function getVisibleQuestions(
  questions: Question[],
  answers: Record<string, AnswerValue>,
): Question[] {
  return questions.filter((q) => isQuestionVisible(q, answers))
}

/**
 * Returns a copy of answers with any key that belongs to a now-hidden
 * question removed. Run this whenever answers change to prevent stale
 * hidden-question data from reaching the backend.
 */
export function pruneHiddenAnswers(
  questions: Question[],
  answers: Record<string, AnswerValue>,
): Record<string, AnswerValue> {
  const visibleIds = new Set(
    getVisibleQuestions(questions, answers).map((q) => q.id)
  )
  const pruned: Record<string, AnswerValue> = {}
  for (const [k, v] of Object.entries(answers)) {
    if (visibleIds.has(k)) pruned[k] = v
  }
  return pruned
}
