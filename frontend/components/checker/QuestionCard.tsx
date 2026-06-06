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
      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
        <span>Question {questionNumber} of {totalQuestions}</span>
        <span className="badge">{pct}% done</span>
      </div>
      <div className="h-1 bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-accent-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Question text + help */}
      <div className="pt-2">
        <h3 className="text-lg sm:text-xl font-semibold text-white leading-snug mb-2">
          {question.question}
        </h3>
        {question.help_text && (
          <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-brand-900/20 border border-brand-700/20">
            <HelpCircle size={14} className="text-brand-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-slate-400 leading-relaxed">{question.help_text}</p>
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
                  'w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-150 text-sm font-medium',
                  sel
                    ? 'bg-brand-600/20 border-brand-500/50 text-brand-200'
                    : 'bg-white/4 border-white/10 text-slate-300 hover:bg-white/8 hover:border-white/20'
                )}
              >
                <span className={clsx('inline-block w-5 h-5 rounded-full border-2 mr-3 align-middle',
                  sel ? 'bg-brand-500 border-brand-400' : 'border-slate-600')} />
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
                  'w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-150 text-sm font-medium flex items-center gap-3',
                  sel
                    ? 'bg-brand-600/20 border-brand-500/50 text-brand-200'
                    : 'bg-white/4 border-white/10 text-slate-300 hover:bg-white/8 hover:border-white/20'
                )}
              >
                <span className={clsx(
                  'w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center',
                  sel ? 'bg-brand-500 border-brand-400' : 'border-slate-600'
                )}>
                  {sel && <CheckCircle size={12} className="text-white" aria-hidden="true" />}
                </span>
                {opt.label}
              </button>
            )
          })}
          <p className="text-xs text-slate-500 pt-1">Select all that apply.</p>
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

  const colourCls = selected && isYes
    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
    : selected && isNo
    ? 'bg-red-500/10 border-red-500/40 text-red-300'
    : selected && isUnknown
    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
    : 'bg-white/4 border-white/10 text-slate-300 hover:bg-white/8 hover:border-white/20'

  const Icon = isYes ? CheckCircle : isNo ? XCircle : CircleHelp
  const iconCls = selected && isYes
    ? 'text-emerald-400'
    : selected && isNo
    ? 'text-red-400'
    : selected && isUnknown
    ? 'text-amber-400'
    : 'text-slate-600'

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onAnswer(val)}
      className={clsx(
        'flex items-center justify-center gap-3 py-4 rounded-2xl border-2 font-semibold text-base transition-all duration-200 active:scale-95',
        colourCls
      )}
    >
      <Icon size={20} className={iconCls} aria-hidden="true" />
      {label}
    </button>
  )
}
