'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { useProfileApi } from '@/lib/useProfileApi'
import { ApiError } from '@/lib/api'
import type { UserProfile } from '@/types/visa'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profile: UserProfile }

interface Props {
  children: (profile: UserProfile) => ReactNode
}

/**
 * Fetches the current user's visa profile and either:
 *   - redirects to /onboarding if no profile or onboarding not completed
 *   - renders children(profile) when the profile is complete
 *
 * Must be placed inside an <AuthGate> (Clerk session already verified).
 */
export function ProfileGate({ children }: Props) {
  const api = useProfileApi()
  const router = useRouter()
  const [state, setState] = useState<State>({ status: 'loading' })

  const checkProfile = async () => {
    setState({ status: 'loading' })
    try {
      const profile = await api.getProfile()
      if (!profile.onboarding_completed) {
        router.replace('/onboarding')
        return
      }
      setState({ status: 'ready', profile })
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        router.replace('/onboarding')
        return
      }
      const message =
        e instanceof ApiError
          ? e.message
          : 'Could not load your profile. Please try again.'
      setState({ status: 'error', message })
    }
  }

  useEffect(() => {
    checkProfile()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <Loader2 size={28} className="animate-spin text-stamp" />
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-support">Loading your profile…</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-md rounded-[4px] border border-seal-text/40 bg-white p-8 text-center shadow-[6px_6px_0_0] shadow-ink/10">
        <AlertCircle size={28} className="mx-auto mb-3 text-seal-text" />
        <p className="mb-4 font-body text-sm text-ink">{state.message}</p>
        <button
          onClick={checkProfile}
          className="btn-secondary inline-flex items-center justify-center gap-2 text-sm"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    )
  }

  return <>{children(state.profile)}</>
}
