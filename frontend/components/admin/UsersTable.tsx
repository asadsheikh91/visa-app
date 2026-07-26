'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAdminApi } from '@/lib/useAdminApi'
import { ApiError } from '@/lib/api'
import { DocCard } from '@/components/ui/DocCard'
import type { AdminUserList } from '@/types/admin'

const PAGE_SIZE = 25

export function UsersTable() {
  const api = useAdminApi()
  const [data, setData] = useState<AdminUserList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.listUsers({ search: query || undefined, limit: PAGE_SIZE, offset })
      setData(res)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [api, query, offset])

  useEffect(() => { load() }, [load])

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    setQuery(search.trim())
  }

  const total = data?.total ?? 0
  const showingFrom = total === 0 ? 0 : offset + 1
  const showingTo = Math.min(offset + PAGE_SIZE, total)

  return (
    <DocCard padded={false}>
      <div className="flex flex-col gap-3 border-b border-hairline px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">Users ({total})</span>
        <form onSubmit={onSearch} className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-support" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            className="w-full rounded-[3px] border border-hairline bg-white py-2 pl-9 pr-3 font-body text-[13px] text-ink placeholder-support focus:border-stamp focus:outline-none sm:w-64"
          />
        </form>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16">
          <Loader2 size={20} className="animate-spin text-stamp" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-support">Loading users…</span>
        </div>
      ) : error ? (
        <p className="px-6 py-8 font-body text-sm text-seal-text">{error}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-hairline text-left">
                {['Email', 'Plan', 'Onboarded', 'Checks', 'Reports', 'Joined'].map((h) => (
                  <th key={h} className="px-6 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-support">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.users.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center font-body text-sm text-support">No users found.</td></tr>
              )}
              {data?.users.map((u) => (
                <tr key={u.id} className="border-b border-hairline/60 transition-colors hover:bg-paper">
                  <td className="px-6 py-3">
                    <Link href={`/admin/users/${u.id}`} className="font-body text-[13px] font-medium text-ink underline-offset-2 hover:underline">
                      {u.email || '(no email)'}
                    </Link>
                    {u.preferred_name && <span className="ml-2 font-body text-[12px] text-support">{u.preferred_name}</span>}
                  </td>
                  <td className="px-6 py-3 font-mono text-[12px] capitalize text-ink">{u.plan}</td>
                  <td className="px-6 py-3 font-body text-[12px] text-support">{u.onboarded ? 'Yes' : 'No'}</td>
                  <td className="px-6 py-3 font-mono text-[12px] text-ink">
                    {u.checks}{u.check_limit != null ? ` / ${u.check_limit}` : ''}
                  </td>
                  <td className="px-6 py-3 font-mono text-[12px] text-ink">
                    {u.reports}{u.report_limit != null ? ` / ${u.report_limit}` : ''}
                  </td>
                  <td className="px-6 py-3 font-body text-[12px] text-support">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-hairline px-6 py-3">
        <span className="font-body text-[12px] text-support">{showingFrom}–{showingTo} of {total}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            disabled={offset === 0 || loading}
            className="inline-flex items-center gap-1 rounded-[3px] border border-hairline px-3 py-1.5 font-body text-[12px] text-ink disabled:opacity-40"
          >
            <ChevronLeft size={13} /> Prev
          </button>
          <button
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            disabled={showingTo >= total || loading}
            className="inline-flex items-center gap-1 rounded-[3px] border border-hairline px-3 py-1.5 font-body text-[12px] text-ink disabled:opacity-40"
          >
            Next <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </DocCard>
  )
}
