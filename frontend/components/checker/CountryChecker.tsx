'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowLeft, Loader2, AlertCircle, RefreshCw, Globe } from 'lucide-react'
import { useVisaApi } from '@/lib/useVisaApi'
import { ApiError } from '@/lib/api'
import {
  isQuestionVisible,
  getVisibleQuestions,
  pruneHiddenAnswers,
} from '@/lib/visibility'
import { QuestionCard } from './QuestionCard'
import { ResultCard } from './ResultCard'
import type { Question, CheckResult, AnswerValue } from '@/types/visa'

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
  const [phase, setPhase] = useState<Phase>('loading')
  const [questions, setQuestions] = useState<Question[]>([])
  // Answers keyed by question.id; multi_choice values are string[]
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [visibleIdx, setVisibleIdx] = useState(0)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState<ErrorState>({ message: '', unsupported: false })
  // Per-question validation error shown inline
  const [fieldError, setFieldError] = useState<string | null>(null)

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
      setAnswers({})
      setVisibleIdx(0)
      setResult(null)
      setFieldError(null)
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
  }, [api, country])

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
      const res = await api.checkReadiness(country, finalAnswers)
      setResult(res)
      setPhase('result')
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to calculate your score. Please try again.'
      setError({ message: msg, unsupported: e instanceof ApiError && e.status === 404 })
      setPhase('error')
    }
  }, [api, country])

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
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={32} className="text-brand-400 animate-spin" />
        <p className="text-slate-500 text-sm">Loading {country.toUpperCase()} questions…</p>
      </div>
    )
  }

  if (phase === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={32} className="text-brand-400 animate-spin" />
        <p className="text-slate-500 text-sm">Calculating your readiness score…</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="glass rounded-2xl p-8 text-center border border-red-500/20">
        <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
        <p className="text-red-300 font-medium mb-4">{error.message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!error.unsupported && (
            <button onClick={loadQuestions} className="btn-secondary text-sm justify-center">
              <RefreshCw size={14} /> Try again
            </button>
          )}
          <Link href="/tools/student-visa/countries" className="btn-primary text-sm justify-center">
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
      <div className="glass rounded-2xl p-8 text-center border border-white/10">
        <Globe size={28} className="text-slate-500 mx-auto mb-3" />
        <p className="text-slate-300 font-medium mb-1">No questions configured for this country yet</p>
        <Link href="/tools/student-visa/countries" className="btn-secondary text-sm justify-center mt-4 inline-flex">
          Choose another country
        </Link>
      </div>
    )
  }

  const total = visibleQuestions.length

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-7 border border-white/10">
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
            className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 p-3"
          >
            <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-red-300">{fieldError}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        {visibleIdx === 0 ? (
          <Link href="/tools/student-visa/countries" className="btn-secondary text-sm py-2.5 px-5">
            <ArrowLeft size={14} /> Countries
          </Link>
        ) : (
          <button onClick={goBack} className="btn-secondary text-sm py-2.5 px-5">
            <ArrowLeft size={14} /> Back
          </button>
        )}

        <button
          onClick={goNext}
          className="btn-primary text-sm py-2.5 px-5 ml-auto"
        >
          {isLast ? 'See results' : 'Next'}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
