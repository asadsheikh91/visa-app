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
  pass: { icon: CheckCircle2,  color: 'text-stamp',     border: 'border-stamp/30 bg-stamp/[0.06]' },
  warn: { icon: AlertTriangle, color: 'text-support',   border: 'border-hairline bg-paper-deep' },
  fail: { icon: AlertCircle,   color: 'text-seal-text', border: 'border-seal-text/40 bg-seal/[0.06]' },
} as const

// ---------------------------------------------------------------------------
// Strength badge
// ---------------------------------------------------------------------------

const STRENGTH_CONFIG = {
  strong:   { label: 'Strong',   color: 'text-stamp',     bg: 'bg-stamp/[0.06] border-stamp/40',        icon: CheckCircle2 },
  moderate: { label: 'Moderate', color: 'text-support',   bg: 'bg-paper-deep border-hairline',          icon: AlertTriangle },
  weak:     { label: 'Weak',     color: 'text-seal-text', bg: 'bg-seal/[0.06] border-seal-text/40',     icon: AlertCircle },
} as const

function StrengthBadge({ strength }: { strength: 'weak' | 'moderate' | 'strong' }) {
  const cfg = STRENGTH_CONFIG[strength]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${cfg.bg} ${cfg.color}`}>
      <Icon size={12} />
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Form field helpers
// ---------------------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-support">{children}</p>
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
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-support">
          {prefix}
        </span>
        <input
          type="number"
          min={0}
          value={value || ''}
          placeholder={placeholder ?? '0'}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full rounded-[3px] border border-hairline bg-white py-2 pl-8 pr-3 font-body text-sm text-ink placeholder-support focus:border-stamp focus:outline-none"
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
        className="w-full appearance-none rounded-[3px] border border-hairline bg-white px-3 py-2 font-body text-sm text-ink focus:border-stamp focus:outline-none"
      >
        {placeholder && <option value="" className="bg-white text-ink">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-white text-ink">{o.label}</option>
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
    <div className="space-y-4 border-t border-hairline pt-4">
      {/* Strength + numbers */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className={cfg.color} />
          <span className="font-body text-sm font-semibold text-ink">Financial Proof Strength</span>
          <StrengthBadge strength={result.strength} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[3px] border border-hairline bg-paper-deep p-3 text-center">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-support">Required estimate</p>
          <p className="font-mono text-sm font-bold text-ink">
            {sym}{result.required_estimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-[3px] border border-hairline bg-paper-deep p-3 text-center">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-support">Available funds</p>
          <p className="font-mono text-sm font-bold text-ink">
            {sym}{result.available_funds.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-[3px] border border-hairline bg-paper-deep p-3 text-center">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-support">Shortfall</p>
          <p className={`font-mono text-sm font-bold ${result.shortfall > 0 ? 'text-seal-text' : 'text-stamp'}`}>
            {result.shortfall > 0
              ? `${sym}${result.shortfall.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : 'None'}
          </p>
        </div>
      </div>

      {/* Rule-by-rule validation (Module B) */}
      {(result.rule_checks?.length ?? 0) > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-support">
            Official rule checks
          </p>
          <ul className="space-y-2">
            {result.rule_checks.map(rc => {
              const cfg = RULE_STATUS_CONFIG[rc.status]
              const Icon = cfg.icon
              return (
                <li key={rc.rule_id} className={`rounded-[3px] border px-3 py-2.5 ${cfg.border}`}>
                  <div className="flex items-start gap-2.5">
                    <Icon size={14} className={`${cfg.color} mt-0.5 flex-shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body text-xs font-semibold text-ink">{rc.label}</p>
                        {rc.threshold && (
                          <span className="flex-shrink-0 font-mono text-[10px] text-support">{rc.threshold}</span>
                        )}
                      </div>
                      <p className="mt-0.5 font-body text-[11px] leading-relaxed text-support">{rc.detail}</p>
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
        <div className="flex items-start gap-2.5 rounded-[3px] border border-seal-text/40 bg-seal/[0.06] px-4 py-3">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-seal-text" />
          <p className="font-body text-xs text-ink">
            Financial proof is not ready yet — your bank statement is missing or uncertain.
            Visa officers will not accept an application without a complete bank statement.
          </p>
        </div>
      )}

      {/* Critical issues */}
      {result.critical_issues.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-support">
            Critical issues
          </p>
          <ul className="space-y-1.5">
            {result.critical_issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 rounded-[3px] border border-seal-text/30 bg-seal/[0.06] px-3 py-2 font-body text-xs text-seal-text">
                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Documents to prepare */}
      <div>
        <p className="mb-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-support">
          Documents to prepare
        </p>
        <ul className="space-y-1.5">
          {result.documents_to_prepare.map((doc, i) => (
            <li key={i} className="flex items-start gap-2 font-body text-xs text-ink">
              <FileText size={12} className="mt-0.5 flex-shrink-0 text-stamp" />
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
      <section className="rounded-[4px] border border-hairline bg-white p-6 text-center shadow-[6px_6px_0_0] shadow-ink/10">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[4px] border border-hairline bg-paper">
          <Lock size={20} className="text-support" />
        </div>
        <h2 className="mb-1 font-serif text-[17px] leading-tight text-ink">Financial Proof Checker</h2>
        <p className="mx-auto mb-5 max-w-sm font-body text-xs text-support">
          Run your first readiness check and we&apos;ll build your visa file — then this checker
          tests your funds against the official financial rules.
        </p>
        <Link href="/tools/student-visa/countries" className="btn-primary text-sm">
          <Sparkles size={14} />
          Start a readiness check
        </Link>
      </section>
    )
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <section className="space-y-0 rounded-[4px] border border-hairline bg-white p-5 shadow-[6px_6px_0_0] shadow-ink/10 sm:p-6">
      {/* Header — only toggleable once a result exists */}
      <button
        type="button"
        onClick={() => result && setFormOpen(o => !o)}
        className={`group flex w-full items-center justify-between gap-3 ${result ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[4px] border border-hairline bg-paper">
            <ShieldCheck size={15} className="text-stamp" />
          </div>
          <div className="text-left">
            <h2 className="font-serif text-[16px] leading-tight text-ink">Financial Proof Checker</h2>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-support">
              {result ? 'Strength assessed — tap to update inputs' : 'Evaluate the strength of your financial evidence'}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {result && <StrengthBadge strength={result.strength} />}
          {result && (formOpen
            ? <ChevronUp size={14} className="text-support" />
            : <ChevronDown size={14} className="text-support" />)}
        </div>
      </button>

      {/* Collapsible form + result */}
      {formOpen && (
        <div className="mt-5 space-y-5">
          {/* Financial figures */}
          <div>
            <p className="mb-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-support">
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
                <div className="w-full rounded-[3px] border border-hairline bg-paper-deep px-3 py-2 font-mono text-sm text-support">
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
              <p className="mb-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-support">
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
            <p className="mb-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-support">
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
            <p className="mb-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-support">
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
            <p className="mb-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-support">
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
            <div className="flex items-center gap-2 rounded-[3px] border border-seal-text/30 bg-seal/[0.06] px-3 py-2 font-body text-xs text-seal-text">
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="btn-primary w-full text-sm"
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
