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
    <section className="space-y-3 rounded-[4px] border-l-2 border-l-stamp border-y border-r border-y-hairline border-r-hairline bg-white p-5">
      {invites.map(inv => (
        <div key={inv.id} className="flex items-center justify-between gap-4">
          <p className="flex min-w-0 items-center gap-2 font-body text-sm text-ink">
            <UserPlus size={15} className="flex-shrink-0 text-stamp" />
            <span className="truncate">
              <span className="font-semibold">{inv.org_name}</span> wants to help manage your
              application. Share your progress with them?
            </span>
          </p>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button type="button" disabled={busyId === inv.id} onClick={() => respond(inv.id, true)}
              className="inline-flex items-center gap-1 rounded-[3px] border border-stamp bg-stamp px-3 py-1.5 font-body text-xs font-semibold text-paper hover:bg-stamp-deep">
              {busyId === inv.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Accept
            </button>
            <button type="button" disabled={busyId === inv.id} onClick={() => respond(inv.id, false)}
              className="inline-flex items-center gap-1 rounded-[3px] border border-hairline bg-white px-3 py-1.5 font-body text-xs font-semibold text-support hover:border-support hover:text-ink">
              <X size={13} /> Decline
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}
