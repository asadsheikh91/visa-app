'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, XCircle, MinusCircle, Loader2, PartyPopper } from 'lucide-react'
import { useOutcomeApi } from '@/lib/useOutcomeApi'
import type { OutcomePrompt as OutcomePromptData, OutcomeStats, VisaOutcomeKind } from '@/types/visa'

const REFUSAL_REASONS = [
  'Financial requirements not met',
  'Documents missing or incorrect',
  'Credibility / interview',
  'English language requirement',
  'CAS / admission issue',
  'Immigration history',
  'Other',
]

/**
 * Dashboard card asking the user to report their visa decision once it's
 * plausible they have one. Feeds the approval-rate data flywheel (Module 3).
 */
export function OutcomePrompt() {
  const api = useOutcomeApi()
  const [data, setData] = useState<OutcomePromptData | null>(null)
  const [mode, setMode] = useState<'ask' | 'refused-reasons' | 'done'>('ask')
  const [reasons, setReasons] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [stats, setStats] = useState<OutcomeStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.getPrompt()
      .then(p => { if (active) setData(p) })
      .catch(() => { /* silent — non-critical dashboard card */ })
    return () => { active = false }
  }, [api])

  const submit = useCallback(async (outcome: VisaOutcomeKind, refusalReasons?: string[]) => {
    if (!data) return
    setSubmitting(true)
    setError(null)
    try {
      await api.report(outcome, {
        country: data.country || undefined,
        visaCheckId: data.visa_check_id,
        refusalReasons,
      })
      setMode('done')
      api.getStats().then(setStats).catch(() => {})
    } catch {
      setError('Could not save — please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [api, data])

  if (!data || !data.should_prompt) return null

  if (mode === 'done') {
    const band = stats?.bands.find(b => !b.insufficient_data && b.approval_rate != null)
    return (
      <section className="glass rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:p-6">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <PartyPopper size={16} className="text-emerald-400" /> Thank you for sharing your result
        </p>
        <p className="text-xs text-slate-400 mt-1">
          It helps us prove what works and improve our scoring for the next applicant.
        </p>
        {band && (
          <p className="text-xs text-emerald-300 mt-3">
            Applicants in the “{band.label}” band were approved ~{band.approval_rate}% of the time
            ({band.total_range} reported decisions).
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="glass rounded-2xl border border-brand-500/20 bg-brand-500/[0.04] p-5 sm:p-6">
      <p className="text-sm font-semibold text-white">How did your visa application go?</p>
      <p className="text-xs text-slate-400 mt-1">
        Your answer is private and helps every future applicant. Takes 5 seconds.
      </p>

      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}

      {mode === 'ask' && (
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" disabled={submitting} onClick={() => submit('approved')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors">
            <CheckCircle2 size={15} /> Approved
          </button>
          <button type="button" disabled={submitting} onClick={() => setMode('refused-reasons')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 transition-colors">
            <XCircle size={15} /> Refused
          </button>
          <button type="button" disabled={submitting} onClick={() => submit('withdrawn')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-colors">
            <MinusCircle size={15} /> Didn’t apply / withdrew
          </button>
        </div>
      )}

      {mode === 'refused-reasons' && (
        <div className="mt-4">
          <p className="text-xs text-slate-300 mb-2">What was the main reason? (optional, select any)</p>
          <div className="flex flex-wrap gap-2">
            {REFUSAL_REASONS.map(r => {
              const on = reasons.includes(r)
              return (
                <button key={r} type="button"
                  onClick={() => setReasons(p => on ? p.filter(x => x !== r) : [...p, r])}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    on ? 'bg-red-500/20 text-red-200 border-red-500/40'
                       : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}`}>
                  {r}
                </button>
              )
            })}
          </div>
          <button type="button" disabled={submitting} onClick={() => submit('refused', reasons)}
            className="btn-primary mt-4 text-sm">
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Submit'}
          </button>
        </div>
      )}
    </section>
  )
}
