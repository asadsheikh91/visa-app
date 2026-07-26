'use client'

import { useState } from 'react'
import { UserCog, CheckCircle2 } from 'lucide-react'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import type { UserProfile } from '@/types/visa'

interface Props {
  profile: UserProfile
  onSaved: (profile: UserProfile) => void
}

/**
 * Dashboard "Profile" section. Reuses the onboarding wizard pre-filled with the
 * user's current answers so they can edit any profile fact that drives the tools
 * (name, destination, funding, background, …). Saves via POST /api/user/profile.
 */
export function ProfileSettings({ profile, onSaved }: Props) {
  const [saved, setSaved] = useState(false)

  return (
    <section className="rounded-[4px] border border-hairline bg-white p-5 shadow-[6px_6px_0_0] shadow-ink/10 sm:p-6">
      <div className="mb-2 flex items-center gap-2">
        <UserCog size={16} className="text-stamp" />
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">Your profile</h2>
      </div>
      <p className="mb-5 font-body text-sm text-support">
        Update your details anytime. Changes apply across your readiness checks, action plan and every tool.
      </p>

      {saved && (
        <div role="status" className="mb-5 flex items-center gap-2 rounded-[3px] border border-stamp/40 bg-stamp/[0.06] p-3">
          <CheckCircle2 size={15} className="flex-shrink-0 text-stamp" aria-hidden="true" />
          <p className="font-body text-[13px] text-ink">Your profile has been updated.</p>
        </div>
      )}

      <OnboardingWizard
        initialData={profile}
        submitLabel="Save changes"
        onComplete={(updated) => {
          setSaved(true)
          onSaved(updated)
          if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    </section>
  )
}
