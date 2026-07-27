'use client'

import { useCallback, useState } from 'react'
import {
  FileText,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Clock,
} from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { ComingSoonPreview } from '@/components/landing/ComingSoonPreview'
import { useSopApi } from '@/lib/useSopApi'
import { ApiError } from '@/lib/api'
import { countryName } from '@/lib/dashboardDisplay'
import type { SopFeedback } from '@/types/visa'

// Flip on once the AI backend key is live: set NEXT_PUBLIC_AI_TOOLS_ENABLED=true.
// Until then we show an honest Coming Soon instead of a form that 503s.
const AI_TOOLS_ENABLED = process.env.NEXT_PUBLIC_AI_TOOLS_ENABLED === 'true'

const COUNTRIES = ['uk', 'usa', 'canada', 'australia'] as const
const MIN_CHARS = 200
const MAX_CHARS = 15_000

function scoreColor(score: number): string {
  if (score >= 75) return 'text-stamp'
  if (score >= 50) return 'text-warn-text'
  return 'text-fail-text'
}

function scoreRing(score: number): string {
  if (score >= 75) return 'border-emerald-500/30 bg-emerald-500/5'
  if (score >= 50) return 'border-amber-500/30 bg-amber-500/5'
  return 'border-red-500/30 bg-red-500/5'
}

// ── Feedback panel ────────────────────────────────────────────────────────────

function FeedbackPanel({ feedback }: { feedback: SopFeedback }) {
  return (
    <div className="space-y-5">
      {/* Overall */}
      <section className="glass rounded-2xl border border-hairline p-5 sm:p-6">
        <div className="flex items-center gap-5">
          <div className={`w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center flex-shrink-0 ${scoreRing(feedback.overall_score)}`}>
            <span className={`text-2xl font-extrabold leading-none ${scoreColor(feedback.overall_score)}`}>
              {feedback.overall_score}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">/ 100</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Overall assessment
            </p>
            <p className="text-sm text-ink leading-relaxed">{feedback.verdict}</p>
          </div>
        </div>
      </section>

      {/* Red flags */}
      {feedback.red_flags.length > 0 && (
        <section className="glass rounded-2xl border border-fail/30 bg-red-500/5 p-5 sm:p-6">
          <p className="text-xs font-semibold text-fail-text uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle size={14} /> Refusal-risk flags
          </p>
          <ul className="space-y-2">
            {feedback.red_flags.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-200">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-fail-text" />
                {f}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sections */}
      {feedback.sections.length > 0 && (
        <section className="glass rounded-2xl border border-hairline p-5 sm:p-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Section-by-section
          </p>
          <div className="space-y-4">
            {feedback.sections.map((s, i) => (
              <div key={i} className="rounded-xl border border-hairline bg-paper-deep p-4">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-sm font-semibold text-ink">{s.name}</p>
                  <span className={`text-sm font-bold ${scoreColor(s.score)}`}>{s.score}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{s.assessment}</p>
                {s.suggestions.length > 0 && (
                  <ul className="mt-2.5 space-y-1.5">
                    {s.suggestions.map((sg, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-slate-300">
                        <CheckCircle2 size={12} className="flex-shrink-0 mt-0.5 text-stamp" />
                        {sg}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rewrite tips */}
      {feedback.rewrite_tips.length > 0 && (
        <section className="glass rounded-2xl border border-hairline p-5 sm:p-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Lightbulb size={14} className="text-warn-text" /> Rewrite tips
          </p>
          <ul className="space-y-2">
            {feedback.rewrite_tips.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <Lightbulb size={13} className="flex-shrink-0 mt-0.5 text-warn-text" />
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ── Content ───────────────────────────────────────────────────────────────────

function SopReviewContent() {
  const api = useSopApi()
  const [text, setText] = useState('')
  const [country, setCountry] = useState('')
  const [feedback, setFeedback] = useState<SopFeedback | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const tooShort = text.trim().length < MIN_CHARS
  const tooLong = text.length > MAX_CHARS

  const onSubmit = useCallback(async () => {
    setLoading(true)
    setError(null)
    setUnavailable(false)
    try {
      const res = await api.reviewSop(text, country || undefined)
      setFeedback(res.feedback)
      setRemaining(res.remaining)
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) {
        setUnavailable(true)
      } else {
        setError(e instanceof ApiError ? e.message : 'Review failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [api, text, country])

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink flex items-center gap-2">
          <FileText size={26} className="text-stamp" />
          SOP reviewer
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Paste your Statement of Purpose and get visa-officer-style feedback on genuineness,
          ties to home, and refusal risks.
        </p>
      </div>

      <section className="glass rounded-2xl border border-hairline p-5 sm:p-6 space-y-4">
        <div>
          <p className="text-xs font-medium text-slate-300 mb-1.5">Destination (optional)</p>
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="w-full bg-paper-deep border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-stamp/40 focus:ring-1 focus:ring-brand-500/20 appearance-none"
          >
            <option value="" className="bg-surface-900">Any / not sure</option>
            {COUNTRIES.map(c => (
              <option key={c} value={c} className="bg-surface-900">{countryName(c)}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-slate-300">Your statement of purpose</p>
            <span className={`text-[11px] ${tooLong ? 'text-fail-text' : 'text-slate-500'}`}>
              {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={12}
            placeholder="Paste your full SOP here…"
            className="w-full bg-paper-deep border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink placeholder-slate-600 focus:outline-none focus:border-stamp/40 focus:ring-1 focus:ring-brand-500/20 resize-y leading-relaxed"
          />
          {tooShort && text.length > 0 && (
            <p className="text-[11px] text-warn-text mt-1">
              At least {MIN_CHARS} characters needed for a useful review.
            </p>
          )}
        </div>

        {error && <p className="text-xs text-fail-text">{error}</p>}

        {unavailable && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <Clock size={15} className="text-warn-text flex-shrink-0 mt-0.5" />
            <p className="text-xs text-warn-text">
              AI review is coming soon — it isn&apos;t switched on yet. Everything else on
              ParchiVisa works in the meantime.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || tooShort || tooLong}
          className="btn-primary w-full justify-center text-sm"
        >
          {loading
            ? <><Loader2 size={14} className="animate-spin" /> Reviewing…</>
            : <><Sparkles size={14} /> Review my SOP</>}
        </button>

        {remaining !== null && (
          <p className="text-[11px] text-slate-500 text-center">
            {remaining} free review{remaining === 1 ? '' : 's'} left today.
          </p>
        )}
      </section>

      {feedback && <FeedbackPanel feedback={feedback} />}
    </div>
  )
}

export default function SopReviewPage() {
  if (!AI_TOOLS_ENABLED) {
    return (
      <div className="min-h-screen pt-24">
        <ComingSoonPreview
          icon={FileText}
          title="SOP Reviewer"
          lede="An officer’s-eye read on your statement — before a real officer gives you theirs."
          worry="“My SOP sounds like everyone else’s.”"
          stakes="Visa officers read thousands of these. A copy-paste, “I’ve always dreamed” statement reads as a non-genuine student — and that verdict has no appeal."
          bullets={[
            'A genuineness score, graded the way an officer reads it',
            'Section-by-section feedback on your intent, ties to home, and funding story',
            'The exact lines that quietly raise a refusal flag — and how to rewrite them',
          ]}
          meanwhile={{ href: '/tools/student-visa/countries', label: 'Meanwhile, check your readiness' }}
          notifySubject="Notify me when the SOP Reviewer is live"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24">
      <AuthGate>
        <SopReviewContent />
      </AuthGate>
    </div>
  )
}
