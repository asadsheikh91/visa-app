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
  critical: { label: 'Fix before applying', icon: AlertTriangle, color: 'text-red-400',    chip: 'bg-red-500/10 text-red-300 border-red-500/30' },
  high:     { label: 'High risk',           icon: ShieldAlert,   color: 'text-orange-400', chip: 'bg-orange-500/10 text-orange-300 border-orange-500/30' },
  soft:     { label: 'Recommended',         icon: Info,          color: 'text-yellow-400', chip: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30' },
  todo:     { label: 'To prepare',          icon: ClipboardList, color: 'text-slate-400',  chip: 'bg-white/5 text-slate-300 border-white/10' },
}

function StepRow({ step }: { step: ActionStep }) {
  const meta = SEVERITY_META[step.severity]
  const Icon = meta.icon
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start gap-3">
        <Icon size={16} className={`${meta.color} flex-shrink-0 mt-0.5`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white leading-snug">{step.title}</p>
          {step.why && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{step.why}</p>}
          {step.how && (
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              <span className="font-semibold text-slate-400">Do this: </span>
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
    <div className="flex items-center gap-2 mb-4">
      <ListChecks size={16} className="text-slate-400" />
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        Your action plan
      </h2>
    </div>
  )

  // ── Locked (no check yet) ──────────────────────────────────────────────────
  if (!checkId) {
    return (
      <section className="glass rounded-2xl border border-white/10 p-6">
        {header}
        <div className="text-center py-4">
          <p className="text-white font-medium text-sm mb-1">No action plan yet</p>
          <p className="text-slate-500 text-xs mb-5 max-w-xs mx-auto">
            Run the readiness checker and we&apos;ll turn your result into a ranked, step-by-step
            plan of exactly what to fix.
          </p>
          <Link href="/tools/student-visa/countries" className="btn-primary text-sm justify-center">
            Start readiness check <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="glass rounded-2xl border border-white/10 p-6">
        {header}
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <section className="glass rounded-2xl border border-white/10 p-6">
        {header}
        <p className="text-sm text-red-300 mb-3">{error}</p>
        <button onClick={() => setNonce(n => n + 1)} className="btn-secondary text-xs py-2 px-3.5">
          <RefreshCw size={13} /> Try again
        </button>
      </section>
    )
  }

  if (!plan) return null

  // ── All clear ──────────────────────────────────────────────────────────────
  if (plan.steps.length === 0) {
    return (
      <section className="glass rounded-2xl border border-white/10 p-6">
        {header}
        <p className="text-sm text-emerald-300/90 flex items-start gap-2">
          <ListChecks size={15} className="flex-shrink-0 mt-0.5 text-emerald-400" />
          Nothing outstanding — no blockers, flags, or pending documents. Keep everything ready.
        </p>
      </section>
    )
  }

  // ── Populated ──────────────────────────────────────────────────────────────
  const activeSeverities = SEVERITY_ORDER.filter(s => (plan.counts[s] ?? 0) > 0)

  return (
    <section className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <ListChecks size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Your action plan
          </h2>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {activeSeverities.map(s => (
            <span key={s} className={`text-[11px] px-2 py-0.5 rounded-full border ${SEVERITY_META[s].chip}`}>
              {plan.counts[s]} {SEVERITY_META[s].label.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-4">
        {plan.steps.length} step{plan.steps.length > 1 ? 's' : ''}, ordered by what matters most.
      </p>

      <ul className="space-y-2.5">
        {plan.steps.map(step => (
          <StepRow key={step.id} step={step} />
        ))}
      </ul>

      {meta && (
        <div className="mt-4 pt-3 border-t border-white/5">
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
