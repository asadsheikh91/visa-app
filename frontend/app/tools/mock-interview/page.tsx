'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MessagesSquare,
  Loader2,
  Send,
  Flag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  UserCircle2,
} from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { ComingSoonPreview } from '@/components/landing/ComingSoonPreview'
import { useInterviewApi } from '@/lib/useInterviewApi'
import { ApiError } from '@/lib/api'
import { countryName } from '@/lib/dashboardDisplay'
import type { InterviewSession, InterviewAssessment } from '@/types/visa'

// Flip on once the AI backend key is live: set NEXT_PUBLIC_AI_TOOLS_ENABLED=true.
// Until then we show an honest Coming Soon instead of a chat that 503s.
const AI_TOOLS_ENABLED = process.env.NEXT_PUBLIC_AI_TOOLS_ENABLED === 'true'

const COUNTRIES = ['uk', 'usa', 'canada', 'australia'] as const

function scoreColor(s: number): string {
  if (s >= 75) return 'text-stamp'
  if (s >= 50) return 'text-warn-text'
  return 'text-fail-text'
}

// ── Assessment panel ──────────────────────────────────────────────────────────

function AssessmentPanel({ a }: { a: InterviewAssessment }) {
  return (
    <section className="glass rounded-2xl border border-hairline p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-4">
        <span className={`text-3xl font-extrabold ${scoreColor(a.overall_score)}`}>{a.overall_score}</span>
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Credibility score</p>
          <p className="text-sm text-ink">{a.verdict}</p>
        </div>
      </div>

      {a.strengths.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-stamp uppercase tracking-wider mb-2">Strengths</p>
          <ul className="space-y-1.5">
            {a.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5 text-stamp" />{s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.weaknesses.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-fail-text uppercase tracking-wider mb-2">Weaknesses</p>
          <ul className="space-y-1.5">
            {a.weaknesses.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-fail-text" />{s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.tips.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-warn-text uppercase tracking-wider mb-2">Tips for the real interview</p>
          <ul className="space-y-1.5">
            {a.tips.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <Lightbulb size={13} className="flex-shrink-0 mt-0.5 text-warn-text" />{s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// ── Content ───────────────────────────────────────────────────────────────────

function MockInterviewContent() {
  const api = useInterviewApi()
  const [country, setCountry] = useState('')
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.transcript.length])

  const handleApiError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 503) setUnavailable(true)
    else setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
  }

  const onStart = useCallback(async () => {
    setBusy(true); setError(null); setUnavailable(false)
    try {
      setSession(await api.start(country || undefined))
    } catch (e) { handleApiError(e) } finally { setBusy(false) }
  }, [api, country])

  const onSend = useCallback(async () => {
    if (!session || !answer.trim()) return
    const text = answer.trim()
    setAnswer(''); setBusy(true); setError(null)
    // optimistic: show the student's answer immediately
    setSession({ ...session, transcript: [...session.transcript, { role: 'student', content: text }] })
    try {
      setSession(await api.reply(session.id, text))
    } catch (e) { handleApiError(e) } finally { setBusy(false) }
  }, [api, session, answer])

  const onFinish = useCallback(async () => {
    if (!session) return
    setBusy(true); setError(null)
    try {
      setSession(await api.finish(session.id))
    } catch (e) { handleApiError(e) } finally { setBusy(false) }
  }, [api, session])

  // ── Intro / start ──────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink flex items-center gap-2">
            <MessagesSquare size={26} className="text-stamp" />
            Mock visa interview
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Practise a realistic credibility interview. Answer naturally — you&apos;ll get a
            scored assessment at the end.
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
          {error && <p className="text-xs text-fail-text">{error}</p>}
          {unavailable && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
              <Clock size={15} className="text-warn-text flex-shrink-0 mt-0.5" />
              <p className="text-xs text-warn-text">
                Mock interviews are coming soon — the AI isn&apos;t switched on yet.
              </p>
            </div>
          )}
          <button type="button" onClick={onStart} disabled={busy} className="btn-primary w-full justify-center text-sm">
            {busy ? <><Loader2 size={14} className="animate-spin" /> Starting…</> : 'Start mock interview'}
          </button>
        </section>
      </div>
    )
  }

  const completed = session.status === 'completed'
  const canContinue = session.can_continue !== false

  // ── Chat ─────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-5">
      <h1 className="text-xl font-bold text-ink flex items-center gap-2">
        <MessagesSquare size={22} className="text-stamp" /> Mock visa interview
      </h1>

      <section className="glass rounded-2xl border border-hairline p-4 sm:p-5">
        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {session.transcript.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'student' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-start gap-2 max-w-[85%] ${t.role === 'student' ? 'flex-row-reverse' : ''}`}>
                {t.role === 'interviewer'
                  ? <UserCircle2 size={20} className="text-stamp flex-shrink-0 mt-1" />
                  : null}
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  t.role === 'student'
                    ? 'bg-stamp/10 border border-stamp/40 text-ink'
                    : 'bg-paper-deep border border-hairline text-ink'
                }`}>
                  {t.content}
                </div>
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <Loader2 size={13} className="animate-spin" /> Officer is thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>
      </section>

      {error && <p className="text-xs text-fail-text">{error}</p>}

      {completed && session.assessment ? (
        <AssessmentPanel a={session.assessment} />
      ) : (
        <section className="glass rounded-2xl border border-hairline p-4 sm:p-5 space-y-3">
          {canContinue ? (
            <>
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                rows={3}
                placeholder="Type your answer…"
                className="w-full bg-paper-deep border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink placeholder-slate-600 focus:outline-none focus:border-stamp/40 focus:ring-1 focus:ring-brand-500/20 resize-y"
              />
              <div className="flex gap-2">
                <button type="button" onClick={onSend} disabled={busy || !answer.trim()} className="btn-primary text-sm flex-1 justify-center">
                  <Send size={14} /> Send answer
                </button>
                <button type="button" onClick={onFinish} disabled={busy} className="btn-secondary text-sm">
                  <Flag size={14} /> Finish
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400">That&apos;s a full interview. Get your assessment:</p>
              <button type="button" onClick={onFinish} disabled={busy} className="btn-primary w-full justify-center text-sm">
                <Flag size={14} /> Finish & get assessment
              </button>
            </>
          )}
        </section>
      )}
    </div>
  )
}

export default function MockInterviewPage() {
  if (!AI_TOOLS_ENABLED) {
    return (
      <div className="min-h-screen pt-24">
        <ComingSoonPreview
          icon={MessagesSquare}
          title="Mock Interview"
          lede="Walk into the real credibility interview having already passed a dozen."
          worry="“The interview decides everything — and I’ve never practised.”"
          stakes="One nervous, contradictory answer about your funds or your plans and your credibility is gone. You don’t get a second interview to redo it."
          bullets={[
            'A realistic credibility interview you can repeat as many times as you need',
            'Follow-up questions that probe the way a real officer does',
            'A scored assessment with your strengths, weak answers, and tips for the day',
          ]}
          meanwhile={{ href: '/tools/student-visa/countries', label: 'Meanwhile, check your readiness' }}
          notifySubject="Notify me when the Mock Interview is live"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24">
      <AuthGate>
        <MockInterviewContent />
      </AuthGate>
    </div>
  )
}
