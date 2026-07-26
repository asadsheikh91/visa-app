'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, ChevronDown, Save } from 'lucide-react'
import { useAdminApi } from '@/lib/useAdminApi'
import { ApiError } from '@/lib/api'
import { DocCard } from '@/components/ui/DocCard'
import type { AdminUserDetail, AdminCheckDetail } from '@/types/admin'

type Tab = 'profile' | 'checks' | 'reports' | 'outcomes' | 'usage'

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile',  label: 'Profile' },
  { id: 'checks',   label: 'Checks' },
  { id: 'reports',  label: 'Reports' },
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'usage',    label: 'Usage' },
]

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline/50 py-2">
      <span className="font-body text-[12.5px] capitalize text-support">{k.replace(/_/g, ' ')}</span>
      <span className="text-right font-body text-[13px] text-ink">{v}</span>
    </div>
  )
}

// --- Plan + cap editor -------------------------------------------------------

function PlanLimitEditor({ detail, onUpdated }: { detail: AdminUserDetail; onUpdated: () => void }) {
  const api = useAdminApi()
  const u = detail.user
  const [plan, setPlan] = useState(u.plan)
  const [checkLimit, setCheckLimit] = useState<string>(u.readiness_check_limit?.toString() ?? '')
  const [reportLimit, setReportLimit] = useState<string>(u.report_limit?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setMsg(null)
    setError(null)
    try {
      await api.updateUser(u.id, {
        plan,
        clear_check_limit: checkLimit.trim() === '',
        readiness_check_limit: checkLimit.trim() === '' ? undefined : Math.max(0, parseInt(checkLimit, 10) || 0),
        clear_report_limit: reportLimit.trim() === '',
        report_limit: reportLimit.trim() === '' ? undefined : Math.max(0, parseInt(reportLimit, 10) || 0),
      })
      setMsg('Saved.')
      onUpdated()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-[3px] border border-hairline bg-white px-3 py-2 font-body text-[13px] text-ink focus:border-stamp focus:outline-none'

  return (
    <DocCard className="p-5">
      <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">Access controls</p>
      <p className="mb-4 font-body text-[12.5px] text-support">
        Effective caps: {u.effective_check_limit ?? 'unlimited'} checks · {u.effective_report_limit ?? 'unlimited'} reports.
        Leave a limit blank to use the default; paid plans are unlimited.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block font-body text-[12px] font-medium text-ink">Plan</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputCls}>
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="team">team</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block font-body text-[12px] font-medium text-ink">Check limit override</span>
          <input value={checkLimit} onChange={(e) => setCheckLimit(e.target.value)} inputMode="numeric" placeholder="default" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-body text-[12px] font-medium text-ink">Report limit override</span>
          <input value={reportLimit} onChange={(e) => setReportLimit(e.target.value)} inputMode="numeric" placeholder="default" className={inputCls} />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary text-sm">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>
        {msg && <span className="font-body text-[12px] text-stamp">{msg}</span>}
        {error && <span className="font-body text-[12px] text-seal-text">{error}</span>}
      </div>
    </DocCard>
  )
}

// --- Check row with lazy answer expansion ------------------------------------

function CheckRow({ userId, check }: { userId: string; check: AdminUserDetail['checks'][number] }) {
  const api = useAdminApi()
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<AdminCheckDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && !detail) {
      setLoading(true)
      try {
        setDetail(await api.getCheck(userId, check.id))
      } catch { /* leave collapsed content empty */ }
      finally { setLoading(false) }
    }
  }

  return (
    <div className="border-b border-hairline/60">
      <button onClick={toggle} className="flex w-full items-center justify-between gap-4 px-1 py-3 text-left">
        <span className="flex items-center gap-3">
          <span className="font-mono text-[13px] font-bold text-ink">{check.score}</span>
          <span className="font-body text-[13px] text-ink">{check.country.toUpperCase()} · {check.result}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="font-body text-[12px] text-support">{new Date(check.created_at).toLocaleDateString()}</span>
          <ChevronDown size={15} className={`text-support transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="pb-4">
          {loading ? (
            <div className="flex items-center gap-2 py-3"><Loader2 size={14} className="animate-spin text-stamp" /><span className="font-body text-[12px] text-support">Loading answers…</span></div>
          ) : detail ? (
            <div className="rounded-[3px] border border-hairline bg-paper p-3">
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-support">Submitted answers</p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-ink">
                {JSON.stringify(detail.normalized_answers, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="font-body text-[12px] text-support">Could not load answers.</p>
          )}
        </div>
      )}
    </div>
  )
}

// --- Main --------------------------------------------------------------------

export function UserDetail({ userId }: { userId: string }) {
  const api = useAdminApi()
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('profile')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDetail(await api.getUser(userId))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load user.')
    } finally {
      setLoading(false)
    }
  }, [api, userId])

  useEffect(() => { load() }, [load])

  return (
    <div className="mx-auto max-w-content px-gutter py-10">
      <Link href="/admin" className="mb-6 inline-flex items-center gap-1.5 font-body text-[13px] text-support hover:text-ink">
        <ArrowLeft size={14} /> Back to admin
      </Link>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-24">
          <Loader2 size={28} className="animate-spin text-stamp" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-support">Loading user…</span>
        </div>
      ) : error ? (
        <p className="rounded-[4px] border border-seal-text/40 bg-white p-6 font-body text-sm text-seal-text">{error}</p>
      ) : detail ? (
        <div className="space-y-6">
          <div className="border-b border-hairline pb-5">
            <h1 className="font-serif text-[26px] leading-tight text-ink">{detail.user.email || '(no email)'}</h1>
            <p className="mt-1 font-mono text-[12px] text-support">
              {detail.user.plan} · joined {new Date(detail.user.created_at).toLocaleDateString()} · {detail.usage.checks} checks · {detail.usage.reports} reports
            </p>
          </div>

          <PlanLimitEditor detail={detail} onUpdated={load} />

          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-[3px] border px-3.5 py-1.5 font-body text-[13px] transition-colors ${
                  tab === t.id ? 'border-stamp bg-stamp/[0.06] text-ink' : 'border-hairline bg-white text-support hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <DocCard className="p-5">
            {tab === 'profile' && (
              detail.profile ? (
                <div>
                  {Object.entries(detail.profile).map(([k, v]) => (
                    <Row key={k} k={k} v={Array.isArray(v) ? (v.join(', ') || '—') : String(v ?? '—')} />
                  ))}
                </div>
              ) : <p className="font-body text-sm text-support">No profile submitted yet.</p>
            )}

            {tab === 'checks' && (
              detail.checks.length ? (
                <div>{detail.checks.map((c) => <CheckRow key={c.id} userId={userId} check={c} />)}</div>
              ) : <p className="font-body text-sm text-support">No readiness checks yet.</p>
            )}

            {tab === 'reports' && (
              detail.reports.length ? (
                <div className="space-y-2">
                  {detail.reports.map((r) => (
                    <div key={r.id} className="flex items-center justify-between border-b border-hairline/60 py-2">
                      <span className="font-mono text-[12.5px] text-ink">{r.report_id}</span>
                      <span className="font-body text-[12px] text-support">
                        {r.narrated_by_ai ? 'AI-narrated' : 'template'} · {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : <p className="font-body text-sm text-support">No reports generated yet.</p>
            )}

            {tab === 'outcomes' && (
              detail.outcomes.length ? (
                <div className="space-y-2">
                  {detail.outcomes.map((o) => (
                    <div key={o.id} className="flex items-center justify-between border-b border-hairline/60 py-2">
                      <span className="font-body text-[13px] capitalize text-ink">{o.outcome}{o.country ? ` · ${o.country.toUpperCase()}` : ''}</span>
                      <span className="font-body text-[12px] text-support">{o.decided_at || new Date(o.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="font-body text-sm text-support">No reported outcomes.</p>
            )}

            {tab === 'usage' && (
              <div>
                <Row k="readiness_checks" v={detail.usage.checks} />
                <Row k="reports" v={detail.usage.reports} />
                <Row k="sop_reviews" v={detail.usage.sop_reviews} />
                <Row k="interview_sessions" v={detail.usage.interview_sessions} />
                <Row k="financial_documents" v={detail.usage.financial_documents} />
                {detail.financial_documents.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-support">Financial documents (PII masked)</p>
                    {detail.financial_documents.map((d) => (
                      <div key={d.id} className="flex items-center justify-between border-b border-hairline/50 py-2">
                        <span className="font-body text-[12.5px] text-ink">{d.bank_id || 'generic'} · {d.status}</span>
                        <span className="font-body text-[12px] text-support">{d.evaluated ? 'evaluated' : 'parsed'} · {new Date(d.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </DocCard>
        </div>
      ) : null}
    </div>
  )
}
