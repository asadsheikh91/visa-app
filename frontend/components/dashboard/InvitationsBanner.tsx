'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserPlus, Check, X, Loader2 } from 'lucide-react'
import { useOrgApi } from '@/lib/useOrgApi'
import type { OrgInvitation } from '@/types/visa'

/**
 * Shows pending consultant invitations to a student and lets them consent
 * (accept) or decline. A consultant can only see the student's data after accept.
 */
export function InvitationsBanner() {
  const api = useOrgApi()
  const [invites, setInvites] = useState<OrgInvitation[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.listInvitations()
      .then(r => { if (active) setInvites(r.invitations) })
      .catch(() => {})
    return () => { active = false }
  }, [api])

  const respond = useCallback(async (id: string, accept: boolean) => {
    setBusyId(id)
    try {
      if (accept) await api.acceptInvitation(id)
      else await api.declineInvitation(id)
      setInvites(prev => prev.filter(i => i.id !== id))
    } catch {
      /* leave it in the list to retry */
    } finally {
      setBusyId(null)
    }
  }, [api])

  if (invites.length === 0) return null

  return (
    <section className="glass rounded-2xl border border-brand-500/20 bg-brand-500/[0.04] p-5 space-y-3">
      {invites.map(inv => (
        <div key={inv.id} className="flex items-center justify-between gap-4">
          <p className="text-sm text-white flex items-center gap-2 min-w-0">
            <UserPlus size={15} className="text-brand-400 flex-shrink-0" />
            <span className="truncate">
              <span className="font-semibold">{inv.org_name}</span> wants to help manage your
              application. Share your progress with them?
            </span>
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" disabled={busyId === inv.id} onClick={() => respond(inv.id, true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25">
              {busyId === inv.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Accept
            </button>
            <button type="button" disabled={busyId === inv.id} onClick={() => respond(inv.id, false)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10">
              <X size={13} /> Decline
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}
