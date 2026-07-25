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
      <section className="rounded-[4px] border-l-2 border-l-stamp border-y border-r border-y-hairline border-r-hairline bg-white p-5 sm:p-6">
        <p className="flex items-center gap-2 font-body text-sm font-semibold text-ink">
          <PartyPopper size={16} className="text-stamp" /> Thank you for sharing your result
        </p>
        <p className="mt-1 font-body text-xs text-support">
          It helps us prove what works and improve our scoring for the next applicant.
        </p>
        {band && (
          <p className="mt-3 font-body text-xs text-stamp">
            Applicants in the “{band.label}” band were approved ~{band.approval_rate}% of the time
            ({band.total_range} reported decisions).
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="rounded-[4px] border-l-2 border-l-stamp border-y border-r border-y-hairline border-r-hairline bg-white p-5 sm:p-6">
      <p className="font-body text-sm font-semibold text-ink">How did your visa application go?</p>
      <p className="mt-1 font-body text-xs text-support">
        Your answer is private and helps every future applicant. Takes 5 seconds.
      </p>

      {error && <p className="mt-2 font-body text-xs text-seal-text">{error}</p>}

      {mode === 'ask' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={submitting} onClick={() => submit('approved')}
            className="inline-flex items-center gap-2 rounded-[3px] border border-stamp bg-stamp px-4 py-2 font-body text-sm font-semibold text-paper transition-colors hover:bg-stamp-deep">
            <CheckCircle2 size={15} /> Approved
          </button>
          <button type="button" disabled={submitting} onClick={() => setMode('refused-reasons')}
            className="inline-flex items-center gap-2 rounded-[3px] border border-seal-text/50 bg-seal/[0.06] px-4 py-2 font-body text-sm font-semibold text-seal-text transition-colors hover:bg-seal/[0.12]">
            <XCircle size={15} /> Refused
          </button>
          <button type="button" disabled={submitting} onClick={() => submit('withdrawn')}
            className="inline-flex items-center gap-2 rounded-[3px] border border-hairline bg-white px-4 py-2 font-body text-sm font-semibold text-support transition-colors hover:border-support hover:text-ink">
            <MinusCircle size={15} /> Didn’t apply / withdrew
          </button>
        </div>
      )}

      {mode === 'refused-reasons' && (
        <div className="mt-4">
          <p className="mb-2 font-body text-xs text-ink">What was the main reason? (optional, select any)</p>
          <div className="flex flex-wrap gap-2">
            {REFUSAL_REASONS.map(r => {
              const on = reasons.includes(r)
              return (
                <button key={r} type="button"
                  onClick={() => setReasons(p => on ? p.filter(x => x !== r) : [...p, r])}
                  className={`rounded-[3px] border px-3 py-1.5 font-body text-xs font-medium transition-colors ${
                    on ? 'border-seal-text/50 bg-seal/[0.1] text-seal-text'
                       : 'border-hairline bg-white text-support hover:border-support hover:text-ink'}`}>
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
