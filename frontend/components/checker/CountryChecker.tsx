'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2, AlertCircle, RefreshCw, Globe } from 'lucide-react'
import { useVisaApi } from '@/lib/useVisaApi'
import { ApiError } from '@/lib/api'
import {
  isQuestionVisible,
  getVisibleQuestions,
  pruneHiddenAnswers,
} from '@/lib/visibility'
import { resolveIntake } from '@/lib/intake'
import { DocCard } from '@/components/ui/DocCard'
import { QuestionCard } from './QuestionCard'
import { ResultCard } from './ResultCard'
import type { Question, CheckResult, AnswerValue } from '@/types/visa'

// Best-effort match for a checker question that captures the applicant's
// intended intake — no current country's live question set has one (verified
// against the seeded data at the time this was written), so this is currently
// inert. It only fires (prefills the answer AND skips the question) when a
// live match exists, so it never risks writing a wrong answer.
function findIntakeQuestion(questions: Question[]): Question | undefined {
  return questions.find((q) => {
    const haystack = `${q.id} ${q.scoring_key ?? ''} ${q.question ?? ''}`.toLowerCase()
    return haystack.includes('intake')
  })
}

type Phase = 'loading' | 'questions' | 'submitting' | 'result' | 'error'

interface ErrorState {
  message: string
  unsupported: boolean
}

interface Props {
  country: string
}

// ---------------------------------------------------------------------------
// Answer validation — works for all input types
// ---------------------------------------------------------------------------

function isAnswerProvided(answer: AnswerValue | undefined): boolean {
  if (answer === undefined || answer === null) return false
  if (Array.isArray(answer)) return answer.length > 0
  if (typeof answer === 'string') return answer.trim() !== ''
  return true
}

// ---------------------------------------------------------------------------
// CountryChecker
// ---------------------------------------------------------------------------

export function CountryChecker({ country }: Props) {
  const api = useVisaApi()
  const searchParams = useSearchParams()
  const intake = resolveIntake(searchParams.get('intake'))
  const [phase, setPhase] = useState<Phase>('loading')
  const [questions, setQuestions] = useState<Question[]>([])
  // Answers keyed by question.id; multi_choice values are string[]
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [visibleIdx, setVisibleIdx] = useState(0)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState<ErrorState>({ message: '', unsupported: false })
  // Per-question validation error shown inline
  const [fieldError, setFieldError] = useState<string | null>(null)
  // Readiness session id (funnel/abandonment tracking), opened on load.
  const [sessionId, setSessionId] = useState<string | null>(null)

  // ── Derived: visible questions filtered by show_if ──────────────────────
  const visibleQuestions = useMemo(
    () => getVisibleQuestions(questions, answers),
    [questions, answers]
  )

  const currentQ  = visibleQuestions[visibleIdx] ?? null
  const isLast    = visibleIdx === visibleQuestions.length - 1
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined

  // ── Clamp visibleIdx when visible list shrinks ───────────────────────────
  useEffect(() => {
    if (visibleIdx >= visibleQuestions.length && visibleQuestions.length > 0) {
      setVisibleIdx(visibleQuestions.length - 1)
    }
  }, [visibleIdx, visibleQuestions.length])

  // ── Load questions ───────────────────────────────────────────────────────
  const loadQuestions = useCallback(async () => {
    setPhase('loading')
    setError({ message: '', unsupported: false })
    try {
      const data = await api.getQuestions(country)
      const qs = Array.isArray(data.questions)
        ? data.questions.filter((q) => q && q.id)
        : []
      setQuestions(qs)

      // ?intake= from the hero's inline starter — only acts when a live
      // question actually captures intake and we have a value for it.
      let initialAnswers: Record<string, AnswerValue> = {}
      let initialIdx = 0
      if (intake && intake.value !== 'unsure') {
        const intakeQ = findIntakeQuestion(qs)
        const prefillValue =
          intakeQ?.input_type === 'date' ? intake.isoDate : intakeQ?.input_type === 'text' ? intake.label : null
        if (intakeQ && prefillValue) {
          initialAnswers = { [intakeQ.id]: prefillValue }
          const visibleAtStart = getVisibleQuestions(qs, initialAnswers)
          const matchIdx = visibleAtStart.findIndex((q) => q.id === intakeQ.id)
          if (matchIdx !== -1) {
            initialIdx = Math.min(matchIdx + 1, Math.max(visibleAtStart.length - 1, 0))
          }
        }
      }
      setAnswers(initialAnswers)
      setVisibleIdx(initialIdx)
      setResult(null)
      setFieldError(null)

      // Open a readiness session — this also enforces the lifetime cap before the
      // user answers anything. A 429 means they're out of free checks.
      try {
        const session = await api.startReadiness(country)
        setSessionId(session.session_id)
      } catch (e) {
        if (e instanceof ApiError && e.status === 429) {
          setError({ message: e.message, unsupported: true })
          setPhase('error')
          return
        }
        // Any other start failure is non-fatal — proceed without a session id.
        setSessionId(null)
      }

      setPhase('questions')
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setError({ message: "This country isn't supported yet.", unsupported: true })
      } else {
        const msg = e instanceof ApiError ? e.message : 'Failed to load questions. Please try again.'
        setError({ message: msg, unsupported: false })
      }
      setPhase('error')
    }
  }, [api, country, intake])

  useEffect(() => { loadQuestions() }, [loadQuestions])

  // ── Record an answer and clean up hidden children ────────────────────────
  const recordAnswer = useCallback((value: string) => {
    if (!currentQ) return
    const qid = currentQ.id

    setAnswers((prev) => {
      let next: Record<string, AnswerValue>

      if (currentQ.input_type === 'multi_choice') {
        const existing = (prev[qid] as string[] | undefined) ?? []
        const toggled  = existing.includes(value)
          ? existing.filter((v) => v !== value)
          : [...existing, value]
        next = { ...prev, [qid]: toggled }
      } else {
        next = { ...prev, [qid]: value }
      }

      // Prune answers that belong to questions that are now hidden.
      // Pass the full question list so pruneHiddenAnswers can re-evaluate
      // visibility with the NEW answers (i.e. after this answer lands).
      return pruneHiddenAnswers(questions, next)
    })

    setFieldError(null)
  }, [currentQ, questions])

  // ── Navigation ───────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    setFieldError(null)
    setVisibleIdx((i) => Math.max(0, i - 1))
  }, [])

  // Validate current question and advance (or submit)
  const goNext = useCallback(() => {
    if (!currentQ) return

    // Required check
    if (currentQ.required && !isAnswerProvided(currentAnswer)) {
      setFieldError(
        currentQ.error_message?.trim()
          || `Please answer this question before continuing.`
      )
      return
    }

    setFieldError(null)

    if (isLast) {
      // Final submit guard: check ALL visible required questions
      const missing = visibleQuestions.filter(
        (q) => q.required && !isAnswerProvided(answers[q.id])
      )
      if (missing.length > 0) {
        // Navigate to first missing visible question
        const missingIdx = visibleQuestions.indexOf(missing[0])
        setVisibleIdx(missingIdx)
        setFieldError(
          missing[0].error_message?.trim()
            || `Please answer this question before continuing.`
        )
        return
      }

      // Submit only answers for currently visible questions
      const visibleAnswers: Record<string, AnswerValue> = {}
      for (const q of visibleQuestions) {
        if (answers[q.id] !== undefined) {
          visibleAnswers[q.id] = answers[q.id]
        }
      }
      submit(visibleAnswers)
    } else {
      setVisibleIdx((i) => i + 1)
    }
  }, [currentQ, currentAnswer, isLast, visibleQuestions, answers])

  // ── Submit ───────────────────────────────────────────────────────────────
  const submit = useCallback(async (finalAnswers: Record<string, AnswerValue>) => {
    setPhase('submitting')
    setError({ message: '', unsupported: false })
    try {
      const res = await api.checkReadiness(country, finalAnswers, sessionId)
      setResult(res)
      setPhase('result')
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to calculate your score. Please try again.'
      setError({ message: msg, unsupported: e instanceof ApiError && e.status === 404 })
      setPhase('error')
    }
  }, [api, country, sessionId])

  const restart = useCallback(() => {
    setAnswers({})
    setVisibleIdx(0)
    setResult(null)
    setFieldError(null)
    setPhase('questions')
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <Loader2 size={32} className="animate-spin text-stamp" />
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-support">Loading {country.toUpperCase()} questions…</p>
      </div>
    )
  }

  if (phase === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <Loader2 size={32} className="animate-spin text-stamp" />
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-support">Calculating your readiness score…</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="rounded-[4px] border border-hairline bg-white p-8 text-center shadow-[6px_6px_0_0] shadow-ink/10">
        <AlertCircle size={32} className="mx-auto mb-3 text-seal-text" />
        <p className="mb-4 font-body font-medium text-ink">{error.message}</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {!error.unsupported && (
            <button onClick={loadQuestions} className="btn-secondary text-sm">
              <RefreshCw size={14} /> Try again
            </button>
          )}
          <Link href="/tools/student-visa/countries" className="btn-primary text-sm">
            Choose another country
          </Link>
        </div>
      </div>
    )
  }

  if (phase === 'result' && result) {
    return <ResultCard result={result} onRetry={restart} />
  }

  if (visibleQuestions.length === 0) {
    return (
      <div className="rounded-[4px] border border-hairline bg-white p-8 text-center shadow-[6px_6px_0_0] shadow-ink/10">
        <Globe size={28} className="mx-auto mb-3 text-support" />
        <p className="mb-1 font-body font-medium text-ink">No questions configured for this country yet</p>
        <Link href="/tools/student-visa/countries" className="mt-4 inline-flex btn-secondary text-sm">
          Choose another country
        </Link>
      </div>
    )
  }

  const total = visibleQuestions.length

  return (
    <div className="space-y-5">
      <DocCard perforated>
        <QuestionCard
          question={currentQ!}
          answer={currentAnswer}
          onAnswer={recordAnswer}
          questionNumber={visibleIdx + 1}
          totalQuestions={total}
        />

        {/* Inline field error */}
        {fieldError && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-[3px] border border-seal-text/40 bg-seal/[0.06] p-3"
          >
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-seal-text" aria-hidden="true" />
            <p className="font-body text-[13px] text-seal-text">{fieldError}</p>
          </div>
        )}
      </DocCard>

      <div className="flex items-center justify-between gap-3">
        {visibleIdx === 0 ? (
          <Link href="/tools/student-visa/countries" className="btn-secondary px-5 py-2.5 text-sm">
            <ArrowLeft size={14} /> Countries
          </Link>
        ) : (
          <button onClick={goBack} className="btn-secondary px-5 py-2.5 text-sm">
            <ArrowLeft size={14} /> Back
          </button>
        )}

        <button
          onClick={goNext}
          className="btn-primary ml-auto px-5 py-2.5 text-sm"
        >
          {isLast ? 'See results' : 'Next'}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
