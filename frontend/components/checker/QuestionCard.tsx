'use client'

/**
 * QuestionCard — renders a single question with the appropriate input control.
 *
 * Supported input types (mirrors backend InputType enum):
 *   yes_no            → Yes / No buttons
 *   yes_no_unknown    → Yes / No / Not sure buttons
 *   single_choice     → option buttons (label displayed, value submitted)
 *   multi_choice      → checkboxes (multiple values; caller manages array state)
 *   currency_amount   → numeric input (no symbol; backend normalises commas)
 *   number            → numeric input
 *   date              → date picker (yields YYYY-MM-DD natively)
 *   text              → text input
 *
 * The onAnswer callback always receives a single string value.
 * Multi-choice array toggling is managed by the parent (CountryChecker).
 */

import { CheckCircle, XCircle, HelpCircle, CircleHelp } from 'lucide-react'
import type { Question, AnswerValue } from '@/types/visa'
import clsx from 'clsx'

interface Props {
  question: Question
  answer?: AnswerValue
  onAnswer: (value: string) => void
  questionNumber: number
  totalQuestions: number
}

export function QuestionCard({ question, answer, onAnswer, questionNumber, totalQuestions }: Props) {
  const pct = totalQuestions > 0 ? Math.round((questionNumber / totalQuestions) * 100) : 0
  const mode = question.input_type

  // Helper: is a single option value currently selected?
  const isSelected = (val: string): boolean => {
    if (Array.isArray(answer)) return answer.includes(val)
    return answer === val
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="mb-2 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-support">
        <span>Question {questionNumber} of {totalQuestions}</span>
        <span>{pct}% done</span>
      </div>
      <div className="h-[6px] overflow-hidden rounded-[2px] bg-paper-deep">
        <div
          className="h-full bg-stamp transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Question text + help */}
      <div className="pt-2">
        <h3 className="mb-2 font-serif text-[22px] leading-snug tracking-[-0.01em] text-ink sm:text-[26px]">
          {question.question}
        </h3>
        {question.help_text && (
          <div className="mt-3 flex items-start gap-2 rounded-[3px] border border-hairline bg-paper-deep p-3">
            <HelpCircle size={14} className="mt-0.5 flex-shrink-0 text-stamp" aria-hidden="true" />
            <p className="font-body text-[13px] leading-relaxed text-support">{question.help_text}</p>
          </div>
        )}
      </div>

      {/* ── yes_no ─────────────────────────────────────────────────────── */}
      {mode === 'yes_no' && (
        <div className="grid grid-cols-2 gap-3">
          {(['yes', 'no'] as const).map((val) => (
            <YesNoButton
              key={val}
              val={val}
              label={val === 'yes' ? 'Yes' : 'No'}
              selected={isSelected(val)}
              onAnswer={onAnswer}
            />
          ))}
        </div>
      )}

      {/* ── yes_no_unknown ─────────────────────────────────────────────── */}
      {mode === 'yes_no_unknown' && (
        <div className="grid grid-cols-3 gap-3">
          {(['yes', 'no', 'unknown'] as const).map((val) => (
            <YesNoButton
              key={val}
              val={val}
              label={val === 'yes' ? 'Yes' : val === 'no' ? 'No' : 'Not sure'}
              selected={isSelected(val)}
              onAnswer={onAnswer}
            />
          ))}
        </div>
      )}

      {/* ── single_choice ──────────────────────────────────────────────── */}
      {mode === 'single_choice' && Array.isArray(question.options) && (
        <div className="space-y-3">
          {question.options.map((opt) => {
            const sel = isSelected(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onAnswer(opt.value)}
                aria-pressed={sel}
                className={clsx(
                  'w-full rounded-[3px] border px-4 py-3.5 text-left font-body text-sm font-medium transition-colors duration-150',
                  sel
                    ? 'border-stamp bg-stamp/[0.06] text-ink'
                    : 'border-hairline bg-white text-support hover:border-support hover:text-ink'
                )}
              >
                <span className={clsx('mr-3 inline-block h-4 w-4 rounded-full border-2 align-middle',
                  sel ? 'border-stamp bg-stamp' : 'border-support')} />
                {opt.label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── multi_choice ───────────────────────────────────────────────── */}
      {mode === 'multi_choice' && Array.isArray(question.options) && (
        <div className="space-y-3">
          {question.options.map((opt) => {
            const sel = isSelected(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                role="checkbox"
                aria-checked={sel}
                onClick={() => onAnswer(opt.value)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-[3px] border px-4 py-3.5 text-left font-body text-sm font-medium transition-colors duration-150',
                  sel
                    ? 'border-stamp bg-stamp/[0.06] text-ink'
                    : 'border-hairline bg-white text-support hover:border-support hover:text-ink'
                )}
              >
                <span className={clsx(
                  'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[2px] border-2',
                  sel ? 'border-stamp bg-stamp' : 'border-support'
                )}>
                  {sel && <CheckCircle size={11} className="text-white" aria-hidden="true" />}
                </span>
                {opt.label}
              </button>
            )
          })}
          <p className="pt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-support">Select all that apply.</p>
        </div>
      )}

      {/* ── currency_amount ────────────────────────────────────────────── */}
      {mode === 'currency_amount' && (
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="Enter amount (numbers only, no symbols)"
          className="input-base"
          aria-label="Currency amount"
        />
      )}

      {/* ── number ─────────────────────────────────────────────────────── */}
      {mode === 'number' && (
        <input
          type="number"
          inputMode="decimal"
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="Enter a number…"
          className="input-base"
          aria-label="Numeric value"
        />
      )}

      {/* ── date ───────────────────────────────────────────────────────── */}
      {mode === 'date' && (
        <input
          type="date"
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onAnswer(e.target.value)}
          className="input-base"
          aria-label="Date"
        />
      )}

      {/* ── text ───────────────────────────────────────────────────────── */}
      {mode === 'text' && (
        <input
          type="text"
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="Type your answer…"
          className="input-base"
          aria-label="Text answer"
        />
      )}

      {/* Fallback for unknown types — renders a plain text input so the app
          doesn't silently break if a new input_type is added to the data. */}
      {!['yes_no','yes_no_unknown','single_choice','multi_choice',
          'currency_amount','number','date','text'].includes(mode) && (
        <input
          type="text"
          value={typeof answer === 'string' ? answer : ''}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="Type your answer…"
          className="input-base"
          aria-label="Answer"
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Internal sub-component
// ---------------------------------------------------------------------------

interface YesNoButtonProps {
  val: string
  label: string
  selected: boolean
  onAnswer: (v: string) => void
}

function YesNoButton({ val, label, selected, onAnswer }: YesNoButtonProps) {
  const isYes     = val === 'yes'
  const isNo      = val === 'no'
  const isUnknown = val === 'unknown'

  // The document system keeps plain Yes/No/Not-sure answers neutral — a chosen
  // "No" is a valid answer, not an error, so it reads in ink, not seal-orange.
  const colourCls = selected && isYes
    ? 'border-stamp bg-stamp/[0.06] text-ink'
    : selected && isNo
    ? 'border-ink bg-ink/[0.04] text-ink'
    : selected && isUnknown
    ? 'border-support bg-support/[0.06] text-ink'
    : 'border-hairline bg-white text-support hover:border-support hover:text-ink'

  const Icon = isYes ? CheckCircle : isNo ? XCircle : CircleHelp
  const iconCls = selected && isYes
    ? 'text-stamp'
    : selected && isNo
    ? 'text-ink'
    : selected && isUnknown
    ? 'text-support'
    : 'text-support'

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onAnswer(val)}
      className={clsx(
        'flex items-center justify-center gap-3 rounded-[3px] border-2 py-4 font-body text-base font-semibold transition-colors duration-200',
        colourCls
      )}
    >
      <Icon size={20} className={iconCls} aria-hidden="true" />
      {label}
    </button>
  )
}
