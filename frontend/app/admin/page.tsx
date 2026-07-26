'use client'

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { AdminGate } from '@/components/auth/AdminGate'
import { KpiCards, FunnelChart, BreakdownCard } from '@/components/admin/KpiCards'
import { UsersTable } from '@/components/admin/UsersTable'
import { useAdminApi } from '@/lib/useAdminApi'
import { ApiError } from '@/lib/api'
import type { AdminOverview } from '@/types/admin'

function AdminDashboard() {
  const api = useAdminApi()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    api
      .getOverview()
      .then(setOverview)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load overview.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-content px-gutter py-10">
      <div className="mb-8 flex items-start justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <h1 className="font-serif text-[30px] leading-tight tracking-[-0.01em] text-ink sm:text-[34px]">Admin panel</h1>
          <p className="mt-2 font-body text-[15px] text-support">Platform metrics, the readiness funnel, and every candidate account.</p>
        </div>
        <button onClick={load} aria-label="Refresh" className="flex-shrink-0 rounded-[3px] p-2 text-support transition-colors hover:bg-white hover:text-ink">
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-24">
          <Loader2 size={28} className="animate-spin text-stamp" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-support">Loading metrics…</span>
        </div>
      ) : error ? (
        <p className="rounded-[4px] border border-seal-text/40 bg-white p-6 font-body text-sm text-seal-text">{error}</p>
      ) : overview ? (
        <div className="space-y-8">
          <KpiCards overview={overview} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2"><FunnelChart overview={overview} /></div>
            <div className="space-y-6">
              <BreakdownCard title="Plans" data={overview.plan_breakdown} />
              <BreakdownCard title="Reported outcomes" data={overview.outcome_breakdown} />
            </div>
          </div>
          <UsersTable />
        </div>
      ) : null}
    </div>
  )
}

export default function AdminPage() {
  return (
    <div className="min-h-screen pt-24">
      <AdminGate>
        <AdminDashboard />
      </AdminGate>
    </div>
  )
}
