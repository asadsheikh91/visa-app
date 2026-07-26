'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Loader2, ShieldAlert } from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { useIsAdmin } from '@/lib/useAdminApi'

function AccessDenied() {
  return (
    <div className="mx-auto max-w-md rounded-[4px] border border-seal-text/40 bg-white p-8 text-center shadow-[6px_6px_0_0] shadow-ink/10">
      <ShieldAlert size={22} className="mx-auto mb-3 text-seal-text" />
      <h2 className="mb-2 font-serif text-[20px] leading-tight text-ink">Access denied</h2>
      <p className="mb-6 font-body text-sm text-support">
        This area is restricted to ParchiVisa administrators.
      </p>
      <Link href="/dashboard" className="btn-secondary text-sm">Back to dashboard</Link>
    </div>
  )
}

function Checking() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <Loader2 size={32} className="animate-spin text-stamp" />
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-support">Verifying admin access…</p>
    </div>
  )
}

function Gate({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useIsAdmin()
  if (loading) return <Checking />
  if (!isAdmin) return <AccessDenied />
  return <>{children}</>
}

/**
 * Wraps admin-only pages: requires a signed-in user (AuthGate), then confirms the
 * account is on the ADMIN_EMAILS allowlist via /api/admin/me. This is a UX gate —
 * every /api/admin/* endpoint independently enforces authorization server-side.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <Gate>{children}</Gate>
    </AuthGate>
  )
}
