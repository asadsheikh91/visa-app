'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import {
  ArrowRight,
  GraduationCap,
  Loader2,
  RefreshCw,
  ClipboardList,
  AlertCircle,
} from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { HistoryResultCard } from '@/components/checker/HistoryResultCard'
import { useVisaApi } from '@/lib/useVisaApi'
import { ApiError } from '@/lib/api'
import type { HistoryItem } from '@/types/visa'

// ---------------------------------------------------------------------------
// DashboardContent — exported for testing
// ---------------------------------------------------------------------------

export function DashboardContent() {
  const { user } = useUser()
  const api = useVisaApi()
  const name = user?.firstName || 'there'

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getHistory()
      setHistory(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      const msg =
        e instanceof ApiError
          ? (e as ApiError).message
          : 'Failed to load your history. Please try again.'
      setError(msg)
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadHistory() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subtitle ────────────────────────────────────────────────────────────
  let subtitle: string
  if (loading) {
    subtitle = 'Loading your history…'
  } else if (error) {
    subtitle = 'Could not load history'
  } else if (history.length > 0) {
    subtitle = `${history.length} check${history.length > 1 ? 's' : ''} completed`
  } else {
    subtitle = 'No checks yet'
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Welcome back, {name}.
          </h1>
          <p className="text-slate-400 mt-1 text-sm">{subtitle}</p>
        </div>
        {!loading && (
          <button
            onClick={loadHistory}
            className="flex-shrink-0 p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
            aria-label="Refresh history"
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 size={22} className="text-brand-400 animate-spin" />
          <span className="text-slate-500 text-sm">Loading your checks…</span>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="glass rounded-2xl p-6 mt-8 text-center border border-red-500/20">
          <AlertCircle size={24} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-300 text-sm mb-4">{error}</p>
          <button
            onClick={loadHistory}
            className="btn-secondary text-sm inline-flex items-center gap-2 justify-center"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────────────────────────── */}
      {!loading && !error && history.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center border border-white/10 mt-8">
          <ClipboardList size={28} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            No checks yet &mdash; run your first one below.
          </p>
        </div>
      )}

      {/* ── History list ──────────────────────────────────────────────────── */}
      {!loading && !error && history.length > 0 && (
        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Past checks
          </h2>
          <ul className="space-y-2">
            {history.map((item: HistoryItem) => (
              <li key={item.id}>
                <HistoryResultCard item={item} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── New check CTA ─────────────────────────────────────────────────── */}
      <div className="glass rounded-2xl p-5 mt-6 flex items-center justify-between gap-4 border border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-600 to-accent-600 flex items-center justify-center flex-shrink-0">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-white text-sm">
              Student Visa Readiness Checker
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              UK &middot; USA &middot; Canada &middot; Australia
            </p>
          </div>
        </div>
        <Link
          href="/tools/student-visa/countries"
          className="btn-primary text-sm flex-shrink-0"
        >
          New check
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page default export — wraps DashboardContent in auth gate
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  return (
    <div className="min-h-screen pt-24">
      <AuthGate>
        <DashboardContent />
      </AuthGate>
    </div>
  )
}
