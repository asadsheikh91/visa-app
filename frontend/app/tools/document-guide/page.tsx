'use client'

import { useCallback, useState } from 'react'
import {
  FileStack,
  Loader2,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Circle,
  Lock,
  Flag,
  ArrowRight,
  Clock,
  Layers,
} from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { useDocumentGuidanceApi } from '@/lib/useDocumentGuidanceApi'
import { ApiError } from '@/lib/api'
import type { DocProfile, OrderedDocumentPlan, DocumentPlanNode, DocStatus } from '@/types/visa'

const HELD_OPTIONS = [
  { id: 'cnic', label: 'CNIC' },
  { id: 'passport', label: 'Passport' },
  { id: 'bachelors_degree', label: "Bachelor's degree" },
  { id: 'bachelors_transcript', label: "Bachelor's transcript" },
]

const STATUS_BADGE: Record<DocStatus, { label: string; cls: string }> = {
  have:        { label: 'Have it',        cls: 'bg-emerald-500/15 text-stamp border-emerald-500/30' },
  done:        { label: 'Done',           cls: 'bg-emerald-500/15 text-stamp border-emerald-500/30' },
  in_progress: { label: 'In progress',    cls: 'bg-stamp/10 text-stamp border-stamp/40' },
  ready:       { label: 'Ready to start', cls: 'bg-amber-500/15 text-warn-text border-amber-500/30' },
  blocked:     { label: 'Blocked',        cls: 'bg-paper-deep text-slate-400 border-hairline' },
}

function fmtMoney(v: number | null): string | null {
  return v == null ? null : `Rs ${v.toLocaleString()}`
}
function fmtDays(v: number | null): string | null {
  return v == null ? null : `~${v} day${v === 1 ? '' : 's'}`
}

// ── One document card ─────────────────────────────────────────────────────────

function DocumentCard({
  node, onSetStatus, onFlag, saving,
}: {
  node: DocumentPlanNode
  onSetStatus: (id: string, status: string) => void
  onFlag: (id: string, note: string) => Promise<void>
  saving: boolean
}) {
  const [lane, setLane] = useState<'normal' | 'urgent'>('normal')
  const [flagOpen, setFlagOpen] = useState(false)
  const [note, setNote] = useState('')
  const [flagDone, setFlagDone] = useState(false)

  const blocked = node.status === 'blocked'
  const obtained = node.status === 'have' || node.status === 'done'
  const badge = STATUS_BADGE[node.status]

  const lanes = lane === 'normal'
    ? { cost: fmtMoney(node.normal.cost), days: fmtDays(node.normal.days), url: undefined as string | undefined }
    : { cost: fmtMoney(node.urgent.cost), days: fmtDays(node.urgent.days), url: node.urgent.appointment_url ?? undefined }

  const submitFlag = async () => {
    if (!note.trim()) return
    await onFlag(node.id, note.trim())
    setFlagDone(true); setFlagOpen(false); setNote('')
  }

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${blocked ? 'border-hairline bg-paper-deep opacity-70' : 'border-hairline bg-paper-deep'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {obtained
            ? <CheckCircle2 size={18} className="text-stamp flex-shrink-0 mt-0.5" />
            : blocked
              ? <Lock size={16} className="text-slate-500 flex-shrink-0 mt-1" />
              : <Circle size={16} className="text-warn-text flex-shrink-0 mt-1" />}
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink leading-snug">{node.name}</p>
            {node.issuing_authority && <p className="text-[11px] text-slate-500 mt-0.5">{node.issuing_authority}</p>}
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {blocked && node.blocked_reason && (
        <p className="text-xs text-slate-500 mt-2 ml-7">Needs {node.prerequisites.join(', ')} first.</p>
      )}

      {!blocked && (
        <>
          {/* Normal / urgent toggle */}
          <div className="mt-3 ml-7">
            <div className="inline-flex rounded-lg border border-hairline bg-paper-deep p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setLane('normal')}
                className={`px-2.5 py-1 rounded-md ${lane === 'normal' ? 'bg-paper-deep text-ink' : 'text-slate-400'}`}
              >Normal</button>
              <button
                type="button"
                onClick={() => setLane('urgent')}
                className={`px-2.5 py-1 rounded-md ${lane === 'urgent' ? 'bg-stamp/10 text-stamp' : 'text-slate-400'}`}
              >Urgent (legal fast-track)</button>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-300">
              <span>{lanes.cost ?? <span className="text-slate-500">See official source</span>}</span>
              {lanes.days && <><span className="text-slate-600">·</span><span className="flex items-center gap-1"><Clock size={11} />{lanes.days}</span></>}
              {lane === 'urgent' && lanes.url && (
                <a href={lanes.url} target="_blank" rel="noopener noreferrer" className="text-stamp hover:text-stamp inline-flex items-center gap-1">
                  Book online <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>

          {/* Unlocks */}
          {node.unlocks.length > 0 && (
            <p className="text-[11px] text-slate-500 mt-3 ml-7">
              Completing this unlocks: <span className="text-slate-400">{node.unlocks.join(', ')}</span>
            </p>
          )}

          {/* Office + map */}
          {node.office && (
            <div className="mt-3 ml-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
              <span>{node.office.address ?? node.office.name}</span>
              {node.office.map_link && (
                <a href={node.office.map_link} target="_blank" rel="noopener noreferrer" className="text-stamp hover:text-stamp inline-flex items-center gap-1">
                  <MapPin size={11} /> Map
                </a>
              )}
              {node.office.hours && <span className="text-slate-600">{node.office.hours}</span>}
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 ml-7 flex flex-wrap items-center gap-2">
            {!obtained && (
              <>
                <button type="button" disabled={saving} onClick={() => onSetStatus(node.id, 'done')} className="btn-primary text-[11px] py-1.5 px-3">
                  Mark obtained
                </button>
                {node.status !== 'in_progress' && (
                  <button type="button" disabled={saving} onClick={() => onSetStatus(node.id, 'in_progress')} className="btn-secondary text-[11px] py-1.5 px-3">
                    Working on it
                  </button>
                )}
              </>
            )}
            {obtained && (
              <button type="button" disabled={saving} onClick={() => onSetStatus(node.id, 'in_progress')} className="btn-secondary text-[11px] py-1.5 px-3">
                Reopen
              </button>
            )}
          </div>
        </>
      )}

      {/* Footer: official link, verified date, flag */}
      <div className="mt-3 ml-7 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-hairline">
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          {node.official_url && (
            <a href={node.official_url} target="_blank" rel="noopener noreferrer" className="text-stamp hover:text-stamp inline-flex items-center gap-1">
              Official source <ExternalLink size={10} />
            </a>
          )}
          {node.last_verified_at && <span>Verified {node.last_verified_at} · check official source</span>}
        </div>
        {flagDone ? (
          <span className="text-[10px] text-stamp">Thanks — flagged</span>
        ) : (
          <button type="button" onClick={() => setFlagOpen(o => !o)} className="text-[10px] text-slate-500 hover:text-slate-300 inline-flex items-center gap-1">
            <Flag size={10} /> This is wrong
          </button>
        )}
      </div>

      {flagOpen && (
        <div className="mt-2 ml-7 flex gap-2">
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What's wrong? (fee changed, office moved…)"
            className="flex-1 bg-paper-deep border border-hairline rounded-lg px-2.5 py-1.5 text-xs text-ink placeholder-slate-600 focus:outline-none focus:border-stamp/40"
          />
          <button type="button" onClick={submitFlag} className="btn-primary text-[11px] py-1.5 px-3">Send</button>
        </div>
      )}
    </div>
  )
}

// ── Content ───────────────────────────────────────────────────────────────────

function DocumentGuideContent() {
  const api = useDocumentGuidanceApi()
  const [profile, setProfile] = useState<DocProfile>({
    target_country: 'uk',
    education_level: 'masters',
    studied_in_pakistan: true,
    marital_status: 'single',
    documents_already_held: [],
  })
  const [plan, setPlan] = useState<OrderedDocumentPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPlan = useCallback(async (p: DocProfile) => {
    setLoading(true); setError(null)
    try {
      setPlan(await api.getPlan(p))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to build your document plan.')
    } finally {
      setLoading(false)
    }
  }, [api])

  const toggleHeld = (id: string) => {
    setProfile(p => ({
      ...p,
      documents_already_held: p.documents_already_held.includes(id)
        ? p.documents_already_held.filter(x => x !== id)
        : [...p.documents_already_held, id],
    }))
  }

  const onSetStatus = useCallback(async (id: string, status: string) => {
    setSavingId(id)
    try {
      await api.updateState(id, status)
      await loadPlan(profile)   // status changes ripple to blocked/ready of others
    } catch { /* keep current plan */ } finally {
      setSavingId(null)
    }
  }, [api, profile, loadPlan])

  const onFlag = useCallback(async (id: string, note: string) => {
    try { await api.submitCorrection(note, id) } catch { /* non-fatal */ }
  }, [api])

  // Group nodes into parallel waves.
  const waves: DocumentPlanNode[][] = []
  if (plan) {
    const byWave = new Map<number, DocumentPlanNode[]>()
    for (const n of plan.nodes) {
      const arr = byWave.get(n.parallel_group) ?? []
      arr.push(n); byWave.set(n.parallel_group, arr)
    }
    for (const k of Array.from(byWave.keys()).sort((a, b) => a - b)) waves.push(byWave.get(k)!)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink flex items-center gap-2">
          <FileStack size={26} className="text-stamp" />
          Document guide
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Tell us a few things and we&apos;ll map the exact documents you need — in order, from the
          official source, with the legal fast-track for each. No agents, no shortcuts.
        </p>
      </div>

      {/* Profile form */}
      <section className="glass rounded-2xl border border-hairline p-5 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-slate-300 mb-1.5">Destination</p>
            <select
              value={profile.target_country}
              onChange={e => setProfile(p => ({ ...p, target_country: e.target.value }))}
              className="w-full bg-paper-deep border border-hairline rounded-lg px-3 py-2 text-sm text-ink appearance-none focus:outline-none focus:border-stamp/40 focus:ring-1 focus:ring-brand-500/20"
            >
              <option value="uk" className="bg-surface-900">United Kingdom</option>
              <option value="usa" className="bg-surface-900">United States</option>
              <option value="canada" className="bg-surface-900">Canada</option>
              <option value="australia" className="bg-surface-900">Australia</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300 mb-1.5">Highest qualification</p>
            <select
              value={profile.education_level}
              onChange={e => setProfile(p => ({ ...p, education_level: e.target.value }))}
              className="w-full bg-paper-deep border border-hairline rounded-lg px-3 py-2 text-sm text-ink appearance-none"
            >
              <option value="masters" className="bg-surface-900">Master&apos;s</option>
              <option value="bachelors" className="bg-surface-900">Bachelor&apos;s</option>
              <option value="intermediate" className="bg-surface-900">Intermediate / A-levels</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300 mb-1.5">Studied in Pakistan?</p>
            <select
              value={profile.studied_in_pakistan ? 'yes' : 'no'}
              onChange={e => setProfile(p => ({ ...p, studied_in_pakistan: e.target.value === 'yes' }))}
              className="w-full bg-paper-deep border border-hairline rounded-lg px-3 py-2 text-sm text-ink appearance-none"
            >
              <option value="yes" className="bg-surface-900">Yes</option>
              <option value="no" className="bg-surface-900">No</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300 mb-1.5">Marital status</p>
            <select
              value={profile.marital_status}
              onChange={e => setProfile(p => ({ ...p, marital_status: e.target.value }))}
              className="w-full bg-paper-deep border border-hairline rounded-lg px-3 py-2 text-sm text-ink appearance-none"
            >
              <option value="single" className="bg-surface-900">Single</option>
              <option value="married" className="bg-surface-900">Married</option>
            </select>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-300 mb-1.5">Which do you already have?</p>
          <div className="flex flex-wrap gap-2">
            {HELD_OPTIONS.map(o => {
              const on = profile.documents_already_held.includes(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggleHeld(o.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${on ? 'bg-stamp/10 text-stamp border-stamp/40' : 'bg-paper-deep text-slate-400 border-hairline hover:text-ink'}`}
                >
                  {on ? '✓ ' : ''}{o.label}
                </button>
              )
            })}
          </div>
        </div>

        {error && <p className="text-xs text-fail-text">{error}</p>}

        <button type="button" onClick={() => loadPlan(profile)} disabled={loading} className="btn-primary w-full justify-center text-sm">
          {loading ? <><Loader2 size={14} className="animate-spin" /> Building your path…</> : <>Show my document path <ArrowRight size={14} /></>}
        </button>
      </section>

      {/* Quest line */}
      {plan && (
        <div className="space-y-5">
          <div className="flex items-center justify-between text-sm">
            <p className="text-slate-400">
              {plan.summary.outstanding} to obtain · {plan.summary.have} done
            </p>
            <span className="text-xs text-slate-500">{plan.waves} step{plan.waves === 1 ? '' : 's'}</span>
          </div>

          {waves.map((wave, i) => (
            <div key={i} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Step {i + 1}</span>
                {wave.length > 1 && (
                  <span className="text-[10px] text-stamp inline-flex items-center gap-1 bg-stamp/10 border border-stamp/40 rounded-full px-2 py-0.5">
                    <Layers size={10} /> Can be done at the same time
                  </span>
                )}
              </div>
              {wave.map(node => (
                <DocumentCard key={node.id} node={node} onSetStatus={onSetStatus} onFlag={onFlag} saving={savingId === node.id} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DocumentGuidePage() {
  return (
    <div className="min-h-screen pt-24">
      <AuthGate>
        <DocumentGuideContent />
      </AuthGate>
    </div>
  )
}
