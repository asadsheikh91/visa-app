'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  DollarSign,
  FileText,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { FinancialProofInputs, FinancialProofResult, VisaFile } from '@/types/visa'
import { useVisaFileApi } from '@/lib/useVisaFileApi'
import { ApiError } from '@/lib/api'
import { SourceCitation } from '@/components/ui/SourceCitation'

// ---------------------------------------------------------------------------
// Currency symbol lookup
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  uk:        '£',
  usa:       '$',
  canada:    'CAD ',
  australia: 'AUD ',
}

function currencySymbol(country: string): string {
  return CURRENCY_SYMBOLS[country.toLowerCase()] ?? '£'
}

// ---------------------------------------------------------------------------
// Empty inputs — the form's initial state
// ---------------------------------------------------------------------------

const EMPTY_INPUTS: FinancialProofInputs = {
  tuition_fee:            0,
  deposit_paid:           0,
  available_funds:        0,
  funding_source:         '',
  funds_in_whose_account: '',
  bank_statement_status:  'not_sure',
  funds_held_duration:    'not_sure',
  large_deposits:         'not_sure',
  source_of_funds:        '',
  income_proof_available: 'no',
  scholarship_or_loan:    'no',
  course_location:        '',
  course_months:          0,
}

// ---------------------------------------------------------------------------
// Rule-check presentation (Module B)
// ---------------------------------------------------------------------------

const RULE_STATUS_CONFIG = {
  pass: { icon: CheckCircle2,  color: 'text-emerald-400', border: 'border-emerald-500/20 bg-emerald-500/5' },
  warn: { icon: AlertTriangle, color: 'text-amber-400',   border: 'border-amber-500/20 bg-amber-500/5' },
  fail: { icon: AlertCircle,   color: 'text-red-400',     border: 'border-red-500/20 bg-red-500/5' },
} as const

// ---------------------------------------------------------------------------
// Strength badge
// ---------------------------------------------------------------------------

const STRENGTH_CONFIG = {
  strong:   { label: 'Strong',   color: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/30', icon: CheckCircle2 },
  moderate: { label: 'Moderate', color: 'text-amber-300',   bg: 'bg-amber-500/15 border-amber-500/30',   icon: AlertTriangle },
  weak:     { label: 'Weak',     color: 'text-red-300',     bg: 'bg-red-500/15 border-red-500/30',       icon: AlertCircle },
} as const

function StrengthBadge({ strength }: { strength: 'weak' | 'moderate' | 'strong' }) {
  const cfg = STRENGTH_CONFIG[strength]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <Icon size={12} />
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Form field helpers
// ---------------------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-slate-300 mb-1.5">{children}</p>
}

function NumberField({
  label, value, prefix, onChange, placeholder,
}: {
  label: string; value: number; prefix: string; onChange: (v: number) => void; placeholder?: string
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
          {prefix}
        </span>
        <input
          type="number"
          min={0}
          value={value || ''}
          placeholder={placeholder ?? '0'}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
        />
      </div>
    </div>
  )
}

function SelectField({
  label, value, options, onChange, placeholder,
}: {
  label: string
  value: string
  options: { label: string; value: string }[]
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 appearance-none"
      >
        {placeholder && <option value="" className="bg-surface-900">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-surface-900">{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Result panel
// ---------------------------------------------------------------------------

function ResultPanel({ result, sym }: { result: FinancialProofResult; sym: string }) {
  const cfg = STRENGTH_CONFIG[result.strength]
  const Icon = cfg.icon

  return (
    <div className="space-y-4 pt-4 border-t border-white/10">
      {/* Strength + numbers */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className={cfg.color} />
          <span className="text-sm font-semibold text-white">Financial Proof Strength</span>
          <StrengthBadge strength={result.strength} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Required estimate</p>
          <p className="text-sm font-bold text-white">
            {sym}{result.required_estimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Available funds</p>
          <p className="text-sm font-bold text-white">
            {sym}{result.available_funds.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Shortfall</p>
          <p className={`text-sm font-bold ${result.shortfall > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {result.shortfall > 0
              ? `${sym}${result.shortfall.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : 'None'}
          </p>
        </div>
      </div>

      {/* Rule-by-rule validation (Module B) */}
      {(result.rule_checks?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Official rule checks
          </p>
          <ul className="space-y-2">
            {result.rule_checks.map(rc => {
              const cfg = RULE_STATUS_CONFIG[rc.status]
              const Icon = cfg.icon
              return (
                <li key={rc.rule_id} className={`rounded-xl border px-3 py-2.5 ${cfg.border}`}>
                  <div className="flex items-start gap-2.5">
                    <Icon size={14} className={`${cfg.color} flex-shrink-0 mt-0.5`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-white">{rc.label}</p>
                        {rc.threshold && (
                          <span className="text-[10px] text-slate-500 flex-shrink-0">{rc.threshold}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{rc.detail}</p>
                      {rc.source?.url && (
                        <div className="mt-1">
                          <SourceCitation label={rc.source.label} url={rc.source.url} />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Bank statement warning banner */}
      {!result.bank_statement_ready && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            Financial proof is not ready yet — your bank statement is missing or uncertain.
            Visa officers will not accept an application without a complete bank statement.
          </p>
        </div>
      )}

      {/* Critical issues */}
      {result.critical_issues.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Critical issues
          </p>
          <ul className="space-y-1.5">
            {result.critical_issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-red-300 rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2">
                <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Documents to prepare */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Documents to prepare
        </p>
        <ul className="space-y-1.5">
          {result.documents_to_prepare.map((doc, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
              <FileText size={12} className="flex-shrink-0 mt-0.5 text-brand-400" />
              {doc}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  file: VisaFile | null
  locked: boolean
  onFileUpdate: (file: VisaFile) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FinancialProofChecker({ file, locked, onFileUpdate }: Props) {
  const fileApi = useVisaFileApi()

  // ── Initialise from persisted proof if available ──────────────────────────
  const savedProof = file?.financial_proof ?? null

  const [inputs, setInputs] = useState<FinancialProofInputs>(
    savedProof ? { ...EMPTY_INPUTS, ...savedProof.inputs } : EMPTY_INPUTS
  )
  const [result, setResult] = useState<FinancialProofResult | null>(
    savedProof ? savedProof.result : null
  )
  const [formOpen, setFormOpen] = useState(!savedProof)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep local state in sync when the parent file prop changes (e.g. after a
  // different check is selected and a new file is loaded).
  useEffect(() => {
    const proof = file?.financial_proof ?? null
    if (proof) {
      setInputs({ ...EMPTY_INPUTS, ...proof.inputs })
      setResult(proof.result)
      setFormOpen(false)
    } else {
      setInputs(EMPTY_INPUTS)
      setResult(null)
      setFormOpen(true)
    }
  }, [file?.id])   // react to a file switch, not to every update

  const sym = useMemo(() => currencySymbol(file?.country ?? ''), [file?.country])
  const isUK = (file?.country ?? '').toLowerCase() === 'uk'

  const set = useCallback(<K extends keyof FinancialProofInputs>(key: K, val: FinancialProofInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: val }))
  }, [])

  const remainingTuition = Math.max(0, inputs.tuition_fee - inputs.deposit_paid)

  const onSubmit = useCallback(async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const { assessment, file: updatedFile } = await fileApi.assessFinancialProof(file.id, inputs)
      setResult(assessment)
      setFormOpen(false)
      onFileUpdate(updatedFile)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Assessment failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [file, fileApi, inputs, onFileUpdate])

  // ── Locked ────────────────────────────────────────────────────────────────
  if (locked) {
    return (
      <section className="glass rounded-2xl border border-white/10 p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
          <Lock size={20} className="text-slate-500" />
        </div>
        <h2 className="text-white font-semibold text-sm mb-1">Financial Proof Checker</h2>
        <p className="text-slate-500 text-xs max-w-sm mx-auto mb-5">
          Run your first readiness check and we&apos;ll build your visa file — then this checker
          tests your funds against the official financial rules.
        </p>
        <Link href="/tools/student-visa/countries" className="btn-primary text-sm justify-center">
          <Sparkles size={14} />
          Start a readiness check
        </Link>
      </section>
    )
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <section className="glass rounded-2xl border border-white/10 p-5 sm:p-6 space-y-0">
      {/* Header — only toggleable once a result exists */}
      <button
        type="button"
        onClick={() => result && setFormOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-3 group ${result ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={15} className="text-brand-400" />
          </div>
          <div className="text-left">
            <h2 className="text-sm font-bold text-white">Financial Proof Checker</h2>
            <p className="text-[11px] text-slate-500">
              {result ? 'Strength assessed — tap to update inputs' : 'Evaluate the strength of your financial evidence'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {result && <StrengthBadge strength={result.strength} />}
          {result && (formOpen
            ? <ChevronUp size={14} className="text-slate-500" />
            : <ChevronDown size={14} className="text-slate-500" />)}
        </div>
      </button>

      {/* Collapsible form + result */}
      {formOpen && (
        <div className="mt-5 space-y-5">
          {/* Financial figures */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Financial figures
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField
                label="Total tuition fee"
                value={inputs.tuition_fee}
                prefix={sym}
                onChange={v => set('tuition_fee', v)}
                placeholder="18000"
              />
              <NumberField
                label="Deposit already paid"
                value={inputs.deposit_paid}
                prefix={sym}
                onChange={v => set('deposit_paid', v)}
                placeholder="0"
              />
              <div>
                <Label>Remaining tuition (auto)</Label>
                <div className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-400">
                  {sym}{remainingTuition.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <NumberField
                label="Available funds"
                value={inputs.available_funds}
                prefix={sym}
                onChange={v => set('available_funds', v)}
                placeholder="16000"
              />
            </div>
          </div>

          {/* UK course details — drive location/length-aware maintenance */}
          {isUK && (
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Course details (UK maintenance)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SelectField
                  label="Study location"
                  value={inputs.course_location}
                  placeholder="Select…"
                  onChange={v => set('course_location', v)}
                  options={[
                    { label: 'Inside London',  value: 'london' },
                    { label: 'Outside London', value: 'outside' },
                  ]}
                />
                <NumberField
                  label="Course length (months)"
                  value={inputs.course_months}
                  prefix="#"
                  onChange={v => set('course_months', v)}
                  placeholder="9"
                />
              </div>
            </div>
          )}

          {/* Funding & account */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Funding & account holder
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Funding source"
                value={inputs.funding_source}
                placeholder="Select…"
                onChange={v => set('funding_source', v)}
                options={[
                  { label: 'Self-funded',       value: 'self_funded' },
                  { label: 'Parent sponsor',     value: 'parent_sponsor' },
                  { label: 'Family sponsor',     value: 'family_sponsor' },
                  { label: 'Employer sponsor',   value: 'employer_sponsor' },
                  { label: 'Other sponsor',      value: 'other_sponsor' },
                  { label: 'Scholarship',        value: 'scholarship' },
                  { label: 'Education loan',     value: 'loan' },
                  { label: 'Mixed',              value: 'mixed' },
                ]}
              />
              <SelectField
                label="Funds in whose account?"
                value={inputs.funds_in_whose_account}
                placeholder="Select…"
                onChange={v => set('funds_in_whose_account', v)}
                options={[
                  { label: 'Own account',   value: 'own' },
                  { label: 'Father',        value: 'father' },
                  { label: 'Mother',        value: 'mother' },
                  { label: 'Spouse',        value: 'spouse' },
                  { label: 'Other relative', value: 'other_relative' },
                ]}
              />
              <SelectField
                label="Source of funds"
                value={inputs.source_of_funds}
                placeholder="Select…"
                onChange={v => set('source_of_funds', v)}
                options={[
                  { label: 'Salary / employment', value: 'salary' },
                  { label: 'Business income',     value: 'business' },
                  { label: 'Savings',             value: 'savings' },
                  { label: 'Property sale',       value: 'property_sale' },
                  { label: 'Loan',                value: 'loan' },
                  { label: 'Other',               value: 'other' },
                ]}
              />
            </div>
          </div>

          {/* Bank statement */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Bank statement & holding period
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Bank statement status"
                value={inputs.bank_statement_status}
                onChange={v => set('bank_statement_status', v)}
                options={[
                  { label: 'Ready',    value: 'ready' },
                  { label: 'Not ready', value: 'not_ready' },
                  { label: 'Not sure', value: 'not_sure' },
                ]}
              />
              <SelectField
                label="Funds held for how long?"
                value={inputs.funds_held_duration}
                onChange={v => set('funds_held_duration', v)}
                options={[
                  { label: '28 days or more',       value: '28_days_plus' },
                  { label: '3 months or more',      value: '3_months_plus' },
                  { label: 'Less than 28 days',     value: 'less_than_28_days' },
                  { label: 'Not sure',              value: 'not_sure' },
                ]}
              />
            </div>
          </div>

          {/* Risk flags */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Risk flags
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SelectField
                label="Large deposits in account?"
                value={inputs.large_deposits}
                onChange={v => set('large_deposits', v)}
                options={[
                  { label: 'No',       value: 'no' },
                  { label: 'Yes',      value: 'yes' },
                  { label: 'Not sure', value: 'not_sure' },
                ]}
              />
              <SelectField
                label="Sponsor income proof available?"
                value={inputs.income_proof_available}
                onChange={v => set('income_proof_available', v)}
                options={[
                  { label: 'Yes', value: 'yes' },
                  { label: 'No',  value: 'no' },
                ]}
              />
              <SelectField
                label="Scholarship or loan involved?"
                value={inputs.scholarship_or_loan}
                onChange={v => set('scholarship_or_loan', v)}
                options={[
                  { label: 'No',  value: 'no' },
                  { label: 'Yes', value: 'yes' },
                ]}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-300 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="btn-primary w-full justify-center text-sm"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analysing…
              </>
            ) : (
              <>
                <DollarSign size={14} />
                Analyse financial proof
              </>
            )}
          </button>
        </div>
      )}

      {/* Result panel — visible when form is collapsed and result exists */}
      {!formOpen && result && (
        <ResultPanel result={result} sym={sym} />
      )}
    </section>
  )
}
