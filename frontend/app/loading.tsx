import { Loader2 } from 'lucide-react'

/**
 * Default route-loading fallback shown during navigation/streaming. Keeps the
 * dark theme so there's no white flash between pages.
 */
export default function Loading() {
  return (
    <div className="min-h-screen pt-24 flex flex-col items-center justify-center gap-4">
      <Loader2 size={28} className="text-[#ff5a1f] animate-spin" />
      <p className="text-slate-500 text-sm">Loading…</p>
    </div>
  )
}
