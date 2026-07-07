'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useJourneyApi } from '@/lib/useJourneyApi'
import { JourneyView } from '@/components/dashboard/JourneyView'
import type { Journey } from '@/types/visa'

/**
 * The guided-journey spine (Module 4) on the dashboard: fetches the user's
 * journey and renders it interactively (steps deep-link into the relevant
 * section/tool).
 */
export function JourneyProgress({ onNavigateSection }: { onNavigateSection?: (section: string) => void }) {
  const api = useJourneyApi()
  const [journey, setJourney] = useState<Journey | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.getJourney()
      .then(j => { if (active) setJourney(j) })
      .catch(() => { /* non-critical */ })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api])

  if (loading) {
    return (
      <section className="glass rounded-2xl border border-white/10 p-5 sm:p-6 flex items-center gap-2 text-slate-400">
        <Loader2 size={16} className="animate-spin" /> Building your application plan…
      </section>
    )
  }
  if (!journey) return null

  return (
    <section className="glass rounded-2xl border border-white/10 p-5 sm:p-6">
      <JourneyView journey={journey} onNavigateSection={onNavigateSection} />
    </section>
  )
}
