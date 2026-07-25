'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ListChecks,
  AlertTriangle,
  ShieldAlert,
  Info,
  ClipboardList,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { useActionPlanApi } from '@/lib/useActionPlanApi'
import { useVisaApi } from '@/lib/useVisaApi'
import { ApiError } from '@/lib/api'
import { SourceCitation } from '@/components/ui/SourceCitation'
import type {
  ActionPlan as ActionPlanData, ActionSeverity, ActionStep, CountryAuthorityMeta,
} from '@/types/visa'

interface Props {
  /** Readiness check to plan for. Null → locked empty state. */
  checkId: string | null
}

// ── Severity presentation ────────────────────────────────────────────────────

const SEVERITY_ORDER: ActionSeverity[] = ['critical', 'high', 'soft', 'todo']

const SEVERITY_META: Record<
  ActionSeverity,
  { label: string; icon: typeof AlertTriangle; color: string; chip: string }
> = {
  critical: { label: 'Fix before applying', icon: AlertTriangle, color: 'text-seal-text', chip: 'bg-seal/[0.06] text-seal-text border-seal-text/40' },
  high:     { label: 'High risk',           icon: ShieldAlert,   color: 'text-seal-text', chip: 'bg-seal/[0.04] text-seal-text border-seal-text/30' },
  soft:     { label: 'Recommended',         icon: Info,          color: 'text-support',   chip: 'bg-paper-deep text-support border-hairline' },
  todo:     { label: 'To prepare',          icon: ClipboardList, color: 'text-support',   chip: 'bg-paper-deep text-support border-hairline' },
}

function StepRow({ step }: { step: ActionStep }) {
  const meta = SEVERITY_META[step.severity]
  const Icon = meta.icon
  return (
    <li className="rounded-[3px] border border-hairline bg-white p-4">
      <div className="flex items-start gap-3">
        <Icon size={16} className={`${meta.color} mt-0.5 flex-shrink-0`} />
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-semibold leading-snug text-ink">{step.title}</p>
          {step.why && <p className="mt-1 font-body text-xs leading-relaxed text-support">{step.why}</p>}
          {step.how && (
            <p className="mt-2 font-body text-xs leading-relaxed text-ink">
              <span className="font-semibold text-support">Do this: </span>
              {step.how}
            </p>
          )}
          {step.source?.url && (
            <div className="mt-2">
              <SourceCitation url={step.source.url} />
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function ActionPlan({ checkId }: Props) {
  const api = useActionPlanApi()
  const visaApi = useVisaApi()
  const [plan, setPlan] = useState<ActionPlanData | null>(null)
  const [meta, setMeta] = useState<CountryAuthorityMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!checkId) {
      setPlan(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getForCheck(checkId)
      .then(p => { if (!cancelled) setPlan(p) })
      .catch(e => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : 'Could not build your action plan. Please try again.')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [checkId, nonce, api])

  // Country authority + last-reviewed date for the trust footer (Module D).
  useEffect(() => {
    const country = plan?.country
    if (!country) { setMeta(null); return }
    let cancelled = false
    visaApi
      .getCountryMeta(country)
      .then(m => { if (!cancelled) setMeta(m) })
      .catch(() => { if (!cancelled) setMeta(null) })   // non-fatal
    return () => { cancelled = true }
  }, [plan?.country, visaApi])

  const header = (
    <div className="mb-4 flex items-center gap-2">
      <ListChecks size={16} className="text-stamp" />
      <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
        Your action plan
      </h2>
    </div>
  )

  // ── Locked (no check yet) ──────────────────────────────────────────────────
  if (!checkId) {
    return (
      <section className="rounded-[4px] border border-hairline bg-white p-6 shadow-[6px_6px_0_0] shadow-ink/10">
        {header}
        <div className="py-4 text-center">
          <p className="mb-1 font-serif text-[17px] leading-tight text-ink">No action plan yet</p>
          <p className="mx-auto mb-5 max-w-xs font-body text-xs text-support">
            Run the readiness checker and we&apos;ll turn your result into a ranked, step-by-step
            plan of exactly what to fix.
          </p>
          <Link href="/tools/student-visa/countries" className="btn-primary text-sm">
            Start readiness check <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="rounded-[4px] border border-hairline bg-white p-6 shadow-[6px_6px_0_0] shadow-ink/10">
        {header}
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-16 animate-pulse rounded-[3px] bg-paper-deep" />
          ))}
        </div>
      </section>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <section className="rounded-[4px] border border-hairline bg-white p-6 shadow-[6px_6px_0_0] shadow-ink/10">
        {header}
        <p className="mb-3 font-body text-sm text-seal-text">{error}</p>
        <button onClick={() => setNonce(n => n + 1)} className="btn-secondary px-3.5 py-2 text-xs">
          <RefreshCw size={13} /> Try again
        </button>
      </section>
    )
  }

  if (!plan) return null

  // ── All clear ──────────────────────────────────────────────────────────────
  if (plan.steps.length === 0) {
    return (
      <section className="rounded-[4px] border border-hairline bg-white p-6 shadow-[6px_6px_0_0] shadow-ink/10">
        {header}
        <p className="flex items-start gap-2 font-body text-sm text-ink">
          <ListChecks size={15} className="mt-0.5 flex-shrink-0 text-stamp" />
          Nothing outstanding — no blockers, flags, or pending documents. Keep everything ready.
        </p>
      </section>
    )
  }

  // ── Populated ──────────────────────────────────────────────────────────────
  const activeSeverities = SEVERITY_ORDER.filter(s => (plan.counts[s] ?? 0) > 0)

  return (
    <section className="rounded-[4px] border border-hairline bg-white p-5 shadow-[6px_6px_0_0] shadow-ink/10 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks size={16} className="text-stamp" />
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
            Your action plan
          </h2>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {activeSeverities.map(s => (
            <span key={s} className={`rounded-[3px] border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${SEVERITY_META[s].chip}`}>
              {plan.counts[s]} {SEVERITY_META[s].label.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      <p className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.1em] text-support">
        {plan.steps.length} step{plan.steps.length > 1 ? 's' : ''}, ordered by what matters most.
      </p>

      <ul className="space-y-2.5">
        {plan.steps.map(step => (
          <StepRow key={step.id} step={step} />
        ))}
      </ul>

      {meta && (
        <div className="mt-4 border-t border-hairline pt-3">
          <SourceCitation
            label={`Guidance: ${meta.authority}`}
            url={meta.official_url}
            lastReviewed={meta.last_reviewed}
          />
        </div>
      )}
    </section>
  )
}
