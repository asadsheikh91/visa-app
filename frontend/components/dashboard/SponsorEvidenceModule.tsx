'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Lock,
  Sparkles,
  Users,
} from 'lucide-react'
import type { SponsorEvidenceInputs, VisaFile, ChecklistItem } from '@/types/visa'
import { useVisaFileApi } from '@/lib/useVisaFileApi'
import { ApiError } from '@/lib/api'
import { STATUS_LABELS, STATUS_DOT } from '@/lib/dashboardDisplay'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESOLVED = new Set(['available', 'not_applicable'])

const EMPTY_INPUTS: SponsorEvidenceInputs = {
  relationship:             '',
  sponsor_name:             '',
  funds_in_sponsor_account: 'not_sure',
  bank_statement_status:    'not_sure',
  income_proof_available:   'no',
  income_type:              '',
  large_deposits:           'not_sure',
  source_explainable:       'not_sure',
}

// ---------------------------------------------------------------------------
// Status derivation from spn_* items
// ---------------------------------------------------------------------------

type EvidenceStatus = 'complete' | 'partial' | 'incomplete'

function deriveStatus(spnItems: ChecklistItem[]): EvidenceStatus {
  if (spnItems.length === 0) return 'incomplete'
  const critical = spnItems.filter(it => it.priority === 'critical')
  if (critical.length === 0) return 'complete'
  const resolved = critical.filter(it => RESOLVED.has(it.status))
  if (resolved.length === critical.length) return 'complete'
  if (resolved.length > 0) return 'partial'
  return 'incomplete'
}

const STATUS_CONFIG: Record<EvidenceStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  complete:   { label: 'Complete',   color: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/30', icon: CheckCircle2 },
  partial:    { label: 'Partial',    color: 'text-amber-300',   bg: 'bg-amber-500/15 border-amber-500/30',   icon: AlertTriangle },
  incomplete: { label: 'Incomplete', color: 'text-red-300',     bg: 'bg-red-500/15 border-red-500/30',       icon: AlertCircle },
}

function StatusBadge({ status }: { status: EvidenceStatus }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <Icon size={12} />
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-slate-300 mb-1.5">{children}</p>
}

function TextField({
  label, value, placeholder, onChange,
}: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
      />
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
// Item status table (reads live from file.items)
// ---------------------------------------------------------------------------

function ItemStatusTable({ items }: { items: ChecklistItem[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Document tracker
      </p>
      <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/[0.06]">
        {items.map(it => (
          <div key={it.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[it.status]}`} />
              <span className="text-xs text-slate-200 truncate">{it.title}</span>
              {it.priority === 'critical' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/25 bg-red-500/10 text-red-300 flex-shrink-0">
                  Critical
                </span>
              )}
              {it.priority === 'standard' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-slate-400 flex-shrink-0">
                  Optional
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 flex-shrink-0">{STATUS_LABELS[it.status]}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 mt-2">
        Update document statuses in the Visa File Builder below.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Result panel
// ---------------------------------------------------------------------------

function ResultPanel({
  status, spnItems, warnings,
}: {
  status: EvidenceStatus
  spnItems: ChecklistItem[]
  warnings: string[]
}) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon

  const criticalMissing = spnItems.filter(
    it => it.priority === 'critical' && !RESOLVED.has(it.status)
  )

  const nextAction = (() => {
    if (status === 'complete') return 'All sponsor evidence items are complete — review before submitting.'
    if (criticalMissing.length > 0) {
      const first = criticalMissing[0].title
      return criticalMissing.length === 1
        ? `Prepare the ${first.toLowerCase()} before applying.`
        : `Prepare ${criticalMissing[0].title.toLowerCase()} and ${criticalMissing.length - 1} other critical item${criticalMissing.length > 2 ? 's' : ''} before applying.`
    }
    return 'Review outstanding sponsor documents and mark them ready in your checklist.'
  })()

  return (
    <div className="space-y-4 pt-4 border-t border-white/10">
      {/* Status */}
      <div className="flex items-center gap-2">
        <Icon size={18} className={cfg.color} />
        <span className="text-sm font-semibold text-white">Sponsor Evidence Status</span>
        <StatusBadge status={status} />
      </div>

      {/* Document tracker */}
      <ItemStatusTable items={spnItems} />

      {/* Missing critical items */}
      {criticalMissing.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Missing critical items
          </p>
          <ul className="space-y-1.5">
            {criticalMissing.map(it => (
              <li key={it.id} className="flex items-start gap-2 text-xs text-red-300 rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2">
                <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                {it.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Warnings
          </p>
          <ul className="space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-300 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next action */}
      <div className="flex items-start gap-2.5 rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3">
        <FileText size={14} className="text-brand-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-brand-200">{nextAction}</p>
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
  /** Pre-fill relationship from the user's onboarding profile. */
  defaultRelationship?: string | null
  onFileUpdate: (file: VisaFile) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SponsorEvidenceModule({ file, locked, defaultRelationship, onFileUpdate }: Props) {
  const fileApi = useVisaFileApi()

  const saved = file?.sponsor_evidence ?? null

  const [inputs, setInputs] = useState<SponsorEvidenceInputs>(
    saved
      ? saved.inputs
      : { ...EMPTY_INPUTS, relationship: defaultRelationship ?? '' }
  )
  const [warnings, setWarnings] = useState<string[]>(saved?.warnings ?? [])
  const [formOpen, setFormOpen] = useState(!saved)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync when the file switches (different check selected).
  useEffect(() => {
    const proof = file?.sponsor_evidence ?? null
    if (proof) {
      setInputs(proof.inputs)
      setWarnings(proof.warnings)
      setFormOpen(false)
    } else {
      setInputs({ ...EMPTY_INPUTS, relationship: defaultRelationship ?? '' })
      setWarnings([])
      setFormOpen(true)
    }
  }, [file?.id])   // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback(<K extends keyof SponsorEvidenceInputs>(
    key: K, val: SponsorEvidenceInputs[K]
  ) => setInputs(prev => ({ ...prev, [key]: val })), [])

  // Live-derived from file.items — updates whenever the user marks items in the checklist.
  const spnItems = (file?.items ?? []).filter(it => it.id.startsWith('spn_'))
  const hasItems = spnItems.length > 0
  const evidenceStatus = deriveStatus(spnItems)

  const onSubmit = useCallback(async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const { warnings: w, file: updatedFile } = await fileApi.assessSponsorEvidence(file.id, inputs)
      setWarnings(w)
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
        <h2 className="text-white font-semibold text-sm mb-1">Sponsor Evidence Module</h2>
        <p className="text-slate-500 text-xs max-w-sm mx-auto mb-5">
          Run your first readiness check to build your visa file — then we&apos;ll tailor the exact
          sponsor documents and letters you need.
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
    <section className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
      {/* Header — collapsible only once items have been injected */}
      <button
        type="button"
        onClick={() => hasItems && setFormOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-3 ${hasItems ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
            <Users size={15} className="text-brand-400" />
          </div>
          <div className="text-left">
            <h2 className="text-sm font-bold text-white">Sponsor Evidence Module</h2>
            <p className="text-[11px] text-slate-500">
              {hasItems
                ? 'Organise your sponsor documents — tap to update inputs'
                : 'Organise and assess your sponsor evidence documents'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasItems && <StatusBadge status={evidenceStatus} />}
          {hasItems && (formOpen
            ? <ChevronUp size={14} className="text-slate-500" />
            : <ChevronDown size={14} className="text-slate-500" />)}
        </div>
      </button>

      {/* Collapsible form */}
      {formOpen && (
        <div className="mt-5 space-y-5">
          {/* Sponsor identity */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              About the sponsor
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Relationship to you"
                value={inputs.relationship}
                placeholder="Select…"
                onChange={v => set('relationship', v)}
                options={[
                  { label: 'Parent',    value: 'parent' },
                  { label: 'Sibling',   value: 'sibling' },
                  { label: 'Relative',  value: 'relative' },
                  { label: 'Spouse',    value: 'spouse' },
                  { label: 'Employer',  value: 'employer' },
                  { label: 'Other',     value: 'other' },
                ]}
              />
              <TextField
                label="Sponsor name (optional)"
                value={inputs.sponsor_name}
                placeholder="e.g. Mohammed Ali"
                onChange={v => set('sponsor_name', v)}
              />
              <SelectField
                label="Is the money in their account?"
                value={inputs.funds_in_sponsor_account}
                onChange={v => set('funds_in_sponsor_account', v)}
                options={[
                  { label: 'Yes',      value: 'yes' },
                  { label: 'No',       value: 'no' },
                  { label: 'Not sure', value: 'not_sure' },
                ]}
              />
            </div>
          </div>

          {/* Bank evidence */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Bank evidence
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Do they have a bank statement?"
                value={inputs.bank_statement_status}
                onChange={v => set('bank_statement_status', v)}
                options={[
                  { label: 'Ready',     value: 'ready' },
                  { label: 'Not ready', value: 'not_ready' },
                  { label: 'Not sure',  value: 'not_sure' },
                ]}
              />
              <SelectField
                label="Are there large recent deposits?"
                value={inputs.large_deposits}
                onChange={v => set('large_deposits', v)}
                options={[
                  { label: 'No',       value: 'no' },
                  { label: 'Yes',      value: 'yes' },
                  { label: 'Not sure', value: 'not_sure' },
                ]}
              />
            </div>
          </div>

          {/* Income & source */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Income & source of funds
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Source of their income"
                value={inputs.income_type}
                placeholder="Select…"
                onChange={v => set('income_type', v)}
                options={[
                  { label: 'Salary / employment', value: 'salary' },
                  { label: 'Business',            value: 'business' },
                  { label: 'Savings',             value: 'savings' },
                  { label: 'Property sale',       value: 'property_sale' },
                  { label: 'Other',               value: 'other' },
                ]}
              />
              <SelectField
                label="Do they have income proof?"
                value={inputs.income_proof_available}
                onChange={v => set('income_proof_available', v)}
                options={[
                  { label: 'Yes', value: 'yes' },
                  { label: 'No',  value: 'no' },
                ]}
              />
              <SelectField
                label="Can they explain source of funds?"
                value={inputs.source_explainable}
                onChange={v => set('source_explainable', v)}
                options={[
                  { label: 'Yes',      value: 'yes' },
                  { label: 'No',       value: 'no' },
                  { label: 'Not sure', value: 'not_sure' },
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
                Assessing…
              </>
            ) : (
              <>
                <Users size={14} />
                Assess sponsor evidence
              </>
            )}
          </button>
        </div>
      )}

      {/* Result panel — visible when form is collapsed */}
      {!formOpen && hasItems && (
        <ResultPanel
          status={evidenceStatus}
          spnItems={spnItems}
          warnings={warnings}
        />
      )}
    </section>
  )
}
