'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { BrandSeal } from '@/components/BrandSeal'
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
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <Loader2 size={28} className="animate-spin text-stamp" />
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-support">
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
    <div className="min-h-screen px-gutter pb-16 pt-24">
      <div className="mx-auto max-w-xl">
        {/* Brand header */}
        <div className="mb-8 flex items-center gap-2.5">
          <BrandSeal className="h-10 w-10" />
          <span className="font-serif text-[19px] leading-none tracking-tight text-ink">
            Parchi<em className="italic">Visa</em>
          </span>
        </div>

        <div className="mb-8">
          <h1 className="mb-2 font-serif text-[28px] leading-tight tracking-[-0.01em] text-ink sm:text-[34px]">
            Set up your profile
          </h1>
          <p className="font-body text-sm text-support">
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
