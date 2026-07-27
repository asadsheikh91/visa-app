'use client'

import { useCallback, useState } from 'react'
import {
  Loader2, ShieldCheck, AlertTriangle, CheckCircle2, XCircle,
  ExternalLink, ArrowRight, RotateCcw, Plus, Trash2, Info,
} from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { useFinancialDocApi } from '@/lib/useFinancialDocApi'
import { ApiError } from '@/lib/api'
import type {
  ManualStatement, BalanceEntry, DocEvaluateContext, FinancialDocResult, RuleStatus,
} from '@/types/visa'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Result rendering ──────────────────────────────────────────────────────────

const STATUS_UI: Record<RuleStatus, { ring: string; text: string; Icon: typeof CheckCircle2; label: string }> = {
  pass: { ring: 'border-emerald-500/30 bg-emerald-500/5', text: 'text-stamp', Icon: CheckCircle2, label: 'Pass' },
  warn: { ring: 'border-amber-500/30 bg-amber-500/5',     text: 'text-warn-text',   Icon: AlertTriangle, label: 'Check' },
  fail: { ring: 'border-red-500/30 bg-red-500/5',         text: 'text-fail-text',     Icon: XCircle,       label: 'Fail' },
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-paper-deep px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-ink mt-0.5 break-words">{value}</p>
    </div>
  )
}

function ResultPanel({ result, onReset }: { result: FinancialDocResult; onReset: () => void }) {
  const top = STATUS_UI[result.overall_status]
  const sym = result.currency_symbol
  return (
    <div className="space-y-5">
      <section className={`glass rounded-2xl border p-5 sm:p-6 ${top.ring}`}>
        <div className="flex items-center gap-4">
          <top.Icon size={34} className={`${top.text} flex-shrink-0`} />
          <div className="min-w-0">
            <p className={`text-sm font-semibold uppercase tracking-wider ${top.text}`}>{top.label}</p>
            <p className="text-sm text-ink leading-relaxed mt-0.5">{result.summary}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
          <Stat label="Required" value={`${sym}${result.required_amount.toLocaleString()}`} />
          <Stat
            label="Lowest balance (28d)"
            value={result.window.min_balance != null ? `${sym}${result.window.min_balance.toLocaleString()}` : '—'}
          />
          <Stat
            label="Window"
            value={result.window.start && result.window.end ? `${result.window.start} → ${result.window.end}` : '—'}
          />
        </div>
      </section>

      <section className="glass rounded-2xl border border-hairline p-5 sm:p-6">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Rule-by-rule check</p>
        <div className="space-y-3">
          {result.rule_checks.map((rc) => {
            const ui = STATUS_UI[rc.status]
            return (
              <div key={rc.rule_id} className={`rounded-xl border p-4 ${ui.ring}`}>
                <div className="flex items-start gap-3">
                  <ui.Icon size={16} className={`${ui.text} flex-shrink-0 mt-0.5`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{rc.label}</p>
                      <span className={`text-[11px] font-bold uppercase ${ui.text}`}>{ui.label}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">{rc.detail}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      <span className="text-[11px] text-slate-500">Threshold: {rc.threshold}</span>
                      {rc.source?.url && (
                        <a href={rc.source.url} target="_blank" rel="noopener noreferrer"
                           className="text-[11px] text-stamp hover:text-stamp inline-flex items-center gap-1">
                          {rc.source.label} <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <button type="button" onClick={onReset} className="btn-secondary w-full justify-center text-sm">
        <RotateCcw size={14} /> Check another statement
      </button>
    </div>
  )
}

// ── Inputs ────────────────────────────────────────────────────────────────────

function Input({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-300 mb-1.5">{label}</p>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-paper-deep border border-hairline rounded-lg px-3 py-2 text-sm text-ink placeholder-slate-600 focus:outline-none focus:border-stamp/40" />
    </div>
  )
}

// ── Manual entry form ─────────────────────────────────────────────────────────

type Row = { date: string; balance: string }

function ManualForm({ onSubmit, submitting }: {
  onSubmit: (stmt: ManualStatement, ctx: DocEvaluateContext) => void
  submitting: boolean
}) {
  const [bankName, setBankName] = useState('')
  const [holder, setHolder] = useState('')
  const [currency, setCurrency] = useState('GBP')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [rows, setRows] = useState<Row[]>([{ date: '', balance: '' }, { date: '', balance: '' }])

  const [applicant, setApplicant] = useState('')
  const [appDate, setAppDate] = useState(todayIso())
  const [tuition, setTuition] = useState('')
  const [deposit, setDeposit] = useState('')
  const [location, setLocation] = useState<'london' | 'outside'>('outside')
  const [months, setMonths] = useState('9')
  const [fxRate, setFxRate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const nonGbp = currency.toUpperCase() !== 'GBP'

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows(rs => [...rs, { date: '', balance: '' }])
  const removeRow = (i: number) => setRows(rs => rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs)

  const submit = () => {
    const entries: BalanceEntry[] = rows
      .filter(r => r.date && r.balance !== '')
      .map(r => ({ date: r.date, balance: Number(r.balance) }))
      .sort((a, b) => (a.date! < b.date! ? -1 : 1))

    if (!periodStart || !periodEnd) { setError('Please enter the statement period start and end dates.'); return }
    if (entries.length < 1) { setError('Add at least one dated balance from your statement.'); return }
    setError(null)

    const stmt: ManualStatement = {
      bank_name: bankName || null,
      account_holder: holder || null,
      currency: currency || null,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      opening_balance: entries[0]?.balance ?? null,
      closing_balance: entries[entries.length - 1]?.balance ?? null,
      transactions: entries,
    }
    const ctx: DocEvaluateContext = {
      applicant_name: applicant || undefined,
      application_date: appDate || undefined,
      tuition_fee: tuition === '' ? undefined : Number(tuition),
      deposit_paid: deposit === '' ? undefined : Number(deposit),
      course_location: location,
      course_months: months === '' ? undefined : Number(months),
      fx_rate_to_gbp: nonGbp && fxRate !== '' ? Number(fxRate) : undefined,
    }
    onSubmit(stmt, ctx)
  }

  return (
    <div className="space-y-5">
      {/* Account details */}
      <section className="glass rounded-2xl border border-hairline p-5 sm:p-6 space-y-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your statement details</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Bank name (optional)" value={bankName} onChange={setBankName} placeholder="e.g. Meezan Bank" />
          <Input label="Account holder" value={holder} onChange={setHolder} placeholder="Name on the account" />
          <Input label="Currency" value={currency} onChange={setCurrency} placeholder="GBP" />
          <div />
          <Input label="Statement period — start" value={periodStart} onChange={setPeriodStart} type="date" />
          <Input label="Statement period — end" value={periodEnd} onChange={setPeriodEnd} type="date" />
        </div>
      </section>

      {/* Balance timeline */}
      <section className="glass rounded-2xl border border-hairline p-5 sm:p-6 space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Account balance over time</p>
        <div className="flex items-start gap-2 rounded-lg border border-hairline bg-paper-deep px-3 py-2">
          <Info size={13} className="text-stamp flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400">
            Enter your balance on the dates shown on your statement — at least the start and end of your
            28-day period, and any date the balance dropped. We use the <span className="text-ink">lowest</span> point
            to check the 28-day rule.
          </p>
        </div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="date" value={r.date} onChange={e => setRow(i, { date: e.target.value })}
                className="flex-1 bg-paper-deep border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-stamp/40" />
              <input type="number" value={r.balance} onChange={e => setRow(i, { balance: e.target.value })}
                placeholder="Balance" inputMode="decimal"
                className="flex-1 bg-paper-deep border border-hairline rounded-lg px-3 py-2 text-sm text-ink placeholder-slate-600 focus:outline-none focus:border-stamp/40" />
              <button type="button" onClick={() => removeRow(i)} aria-label="Remove row"
                className="p-2 rounded-lg text-slate-500 hover:text-fail-text hover:bg-paper-deep">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stamp hover:text-stamp">
          <Plus size={14} /> Add balance row
        </button>
      </section>

      {/* Application context */}
      <section className="glass rounded-2xl border border-hairline p-5 sm:p-6 space-y-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your application details</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Your full name (as on application)" value={applicant} onChange={setApplicant} />
          <Input label="Application date" value={appDate} onChange={setAppDate} type="date" />
          <Input label="First-year tuition (£)" value={tuition} onChange={setTuition} type="number" />
          <Input label="Tuition deposit already paid (£)" value={deposit} onChange={setDeposit} type="number" />
          <div>
            <p className="text-xs font-medium text-slate-300 mb-1.5">Course location</p>
            <select value={location} onChange={e => setLocation(e.target.value as 'london' | 'outside')}
              className="w-full bg-paper-deep border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-stamp/40 appearance-none">
              <option value="outside" className="bg-surface-900">Outside London</option>
              <option value="london" className="bg-surface-900">London</option>
            </select>
          </div>
          <Input label="Course length (months, max 9 counts)" value={months} onChange={setMonths} type="number" />
          {nonGbp && (
            <Input label={`Conversion rate (1 ${currency.toUpperCase()} = ? GBP)`} value={fxRate} onChange={setFxRate} type="number" />
          )}
        </div>
        {nonGbp && (
          <p className="text-[11px] text-warn-text/90">
            Your balances aren&apos;t in GBP — enter the conversion rate so funds can be compared to the requirement.
          </p>
        )}
      </section>

      {error && <p className="text-xs text-fail-text">{error}</p>}

      <button type="button" onClick={submit} disabled={submitting} className="btn-primary w-full justify-center text-sm">
        {submitting
          ? <><Loader2 size={14} className="animate-spin" /> Checking against the rules…</>
          : <>Check against UK rules <ArrowRight size={15} /></>}
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function FinancialDocContent() {
  const api = useFinancialDocApi()
  const [result, setResult] = useState<FinancialDocResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = useCallback(async (stmt: ManualStatement, ctx: DocEvaluateContext) => {
    setBusy(true); setError(null)
    try {
      const res = await api.evaluate(stmt, ctx, 'uk')
      setResult(res.result)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Evaluation failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [api])

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink flex items-center gap-2">
          <ShieldCheck size={26} className="text-stamp" />
          Bank statement checker
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Enter the figures from your bank statement (UK Student route). We check them against the
          official financial rules — including the 28-day rule. Our rules decide the result; no AI guesses it.
        </p>
      </div>

      {error && <p className="text-xs text-fail-text">{error}</p>}

      {result
        ? <ResultPanel result={result} onReset={() => setResult(null)} />
        : <ManualForm onSubmit={onSubmit} submitting={busy} />}
    </div>
  )
}

export default function FinancialDocumentPage() {
  return (
    <div className="min-h-screen pt-24">
      <AuthGate>
        <FinancialDocContent />
      </AuthGate>
    </div>
  )
}
