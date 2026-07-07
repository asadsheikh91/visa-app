'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Loader2 } from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { useProfileApi } from '@/lib/useProfileApi'
import { ApiError } from '@/lib/api'
import type { UserProfile } from '@/types/visa'

type State =
  | { status: 'loading' }
  | { status: 'ready'; existing?: Partial<UserProfile> }
  | { status: 'redirecting' }

function OnboardingContent() {
  const api = useProfileApi()
  const router = useRouter()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    api.getProfile()
      .then(profile => {
        if (profile.onboarding_completed) {
          // Already done — skip back to dashboard
          setState({ status: 'redirecting' })
          router.replace('/dashboard')
        } else {
          // Resume with partial data pre-filled
          setState({ status: 'ready', existing: profile })
        }
      })
      .catch(e => {
        if (e instanceof ApiError && e.status === 404) {
          // No profile yet — fresh start
          setState({ status: 'ready' })
        } else {
          // Network error, auth error, etc. — still show the wizard so the
          // user isn't blocked; first save will create the profile.
          setState({ status: 'ready' })
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (state.status === 'loading' || state.status === 'redirecting') {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 size={28} className="text-brand-400 animate-spin" />
        <p className="text-slate-500 text-sm">
          {state.status === 'redirecting' ? 'Taking you to your dashboard…' : 'Getting things ready…'}
        </p>
      </div>
    )
  }

  return (
    <OnboardingWizard
      initialData={state.existing}
      onComplete={() => router.replace('/dashboard')}
    />
  )
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container-inner px-4 max-w-xl mx-auto">
        {/* Brand header */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-accent-600 flex items-center justify-center shadow-lg shadow-brand-900/40">
            <GraduationCap size={18} className="text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">ParchiVisa</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Set up your profile
          </h1>
          <p className="text-slate-400 text-sm">
            A few quick questions so we can personalise your dashboard and readiness checks.
          </p>
        </div>

        <AuthGate>
          <OnboardingContent />
        </AuthGate>
      </div>
    </div>
  )
}
