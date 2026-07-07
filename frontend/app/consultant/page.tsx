'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Building2, Loader2, UserPlus, Trash2, ArrowLeft, Users, Clock, CheckCircle2,
} from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { ComingSoonPreview } from '@/components/landing/ComingSoonPreview'
import { JourneyView } from '@/components/dashboard/JourneyView'
import { useOrgApi } from '@/lib/useOrgApi'
import { ApiError } from '@/lib/api'
import type { MyOrg, RosterClient, Journey } from '@/types/visa'

// The agency workspace is built but not open to the public yet. Flip on with
// NEXT_PUBLIC_AGENCY_ENABLED=true when you're ready to onboard consultants.
const AGENCY_ENABLED = process.env.NEXT_PUBLIC_AGENCY_ENABLED === 'true'

// ── Create-workspace gate ─────────────────────────────────────────────────────

function CreateWorkspace({ onCreated }: { onCreated: () => void }) {
  const api = useOrgApi()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    if (!name.trim()) return
    setBusy(true); setError(null)
    try {
      await api.createOrg(name.trim())
      onCreated()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create workspace.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <Building2 size={36} className="text-brand-400 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-white">Create your agency workspace</h1>
      <p className="text-slate-400 text-sm mt-2">
        Manage all your students in one place — see each applicant&apos;s readiness, blockers, and
        next action at a glance.
      </p>
      <div className="mt-6 space-y-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bright Future Consultants"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50" />
        {error && <p className="text-xs text-red-300">{error}</p>}
        <button type="button" onClick={create} disabled={busy || !name.trim()} className="btn-primary w-full justify-center text-sm">
          {busy ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : 'Create workspace'}
        </button>
      </div>
    </div>
  )
}

// ── Client detail (read-only journey) ─────────────────────────────────────────

function ClientDetail({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const api = useOrgApi()
  const [data, setData] = useState<{ email: string; journey: Journey } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.getClientJourney(clientId)
      .then(r => { if (active) setData(r) })
      .catch(e => { if (active) setError(e instanceof ApiError ? e.message : 'Could not load this client.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api, clientId])

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft size={15} /> Back to roster
      </button>
      {loading && <p className="text-slate-400 text-sm flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Loading…</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}
      {data && (
        <section className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
          <p className="text-sm font-semibold text-white mb-4">{data.email}</p>
          <JourneyView journey={data.journey} interactive={false} />
        </section>
      )}
    </div>
  )
}

// ── Roster ────────────────────────────────────────────────────────────────────

function Roster({ org }: { org: NonNullable<MyOrg['org']> }) {
  const api = useOrgApi()
  const [clients, setClients] = useState<RosterClient[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.listClients()
      setClients(r.clients)
    } catch {
      setError('Could not load your roster.')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => { load() }, [load])

  const invite = async () => {
    if (!email.trim()) return
    setInviting(true); setError(null)
    try {
      await api.inviteClient(email.trim())
      setEmail('')
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send invitation.')
    } finally {
      setInviting(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await api.removeClient(id)
      setClients(prev => prev.filter(c => c.id !== id))
    } catch { /* ignore */ }
  }

  if (selected) return <ClientDetail clientId={selected} onBack={() => { setSelected(null); load() }} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 size={24} className="text-brand-400" /> {org.name}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Your client roster.</p>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
          {org.plan} plan
        </span>
      </div>

      {/* Invite */}
      <section className="glass rounded-2xl border border-white/10 p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <p className="text-xs font-medium text-slate-300 mb-1.5">Invite a student by email</p>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="student@email.com"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50" />
        </div>
        <button type="button" onClick={invite} disabled={inviting || !email.trim()} className="btn-primary justify-center text-sm">
          {inviting ? <><Loader2 size={14} className="animate-spin" /> Inviting…</> : <><UserPlus size={14} /> Invite</>}
        </button>
      </section>
      {error && <p className="text-xs text-red-300">{error}</p>}

      {/* Roster list */}
      {loading ? (
        <p className="text-slate-400 text-sm flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Loading roster…</p>
      ) : clients.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-8 text-center">
          <Users size={28} className="text-slate-500 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No clients yet. Invite your first student above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map(c => {
            const pending = c.status === 'invited'
            return (
              <div key={c.id} className="glass rounded-xl border border-white/10 p-4 flex items-center justify-between gap-4">
                <button type="button" disabled={pending} onClick={() => !pending && setSelected(c.id)}
                  className={`flex items-center gap-3 min-w-0 text-left ${pending ? '' : 'hover:opacity-90'}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{c.email}</p>
                    {pending ? (
                      <span className="text-[11px] text-amber-300 inline-flex items-center gap-1">
                        <Clock size={11} /> Invitation pending acceptance
                      </span>
                    ) : c.journey ? (
                      <span className="text-[11px] text-slate-400">
                        {c.journey.complete
                          ? <span className="text-emerald-300 inline-flex items-center gap-1"><CheckCircle2 size={11} /> Ready to apply</span>
                          : `${c.journey.overall_pct}% ready · next: ${c.journey.next_action_label}`}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">Active</span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {!pending && c.journey && (
                    <div className="hidden sm:block w-24 h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-500 to-brand-400" style={{ width: `${c.journey.overall_pct}%` }} />
                    </div>
                  )}
                  <button type="button" onClick={() => remove(c.id)} aria-label="Remove client"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-white/5">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function ConsultantContent() {
  const api = useOrgApi()
  const [my, setMy] = useState<MyOrg | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setMy(await api.getMyOrg())
    } catch {
      setMy({ org: null })
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading workspace…
      </div>
    )
  }

  if (!my?.org) {
    return <CreateWorkspace onCreated={load} />
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Roster org={my.org} />
    </div>
  )
}

export default function ConsultantPage() {
  if (!AGENCY_ENABLED) {
    return (
      <div className="min-h-screen pt-24">
        <ComingSoonPreview
          icon={Building2}
          title="Agency Workspace"
          lede="One honest workspace for consultants who refuse to guess with a student’s future."
          worry="“I’m juggling thirty student files — and I can’t see who’s actually at risk.”"
          stakes="When you manage applicants in spreadsheets and WhatsApp, the one with a broken bank statement looks identical to the one who’s ready. You find out which was which only after the refusal."
          bullets={[
            'Every student’s readiness, blockers and next action in a single view',
            'Invite applicants and follow their progress from check to visa day',
            'The same rules-based, source-linked engine your students trust — built for your whole roster',
          ]}
          meanwhile={{ href: '/tools/student-visa/countries', label: 'Try the student checker first' }}
          notifySubject="Notify me when the Agency Workspace opens"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24">
      <AuthGate>
        <ConsultantContent />
      </AuthGate>
    </div>
  )
}
