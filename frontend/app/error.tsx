'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Route-level error boundary. Catches unexpected throws in a route segment's
 * client components and shows a branded recovery screen instead of Next.js's
 * default error page. Rendered inside the root layout (Navbar/Footer remain).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface for client-side logging / observability.
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen pt-24 flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 sm:p-10 text-center max-w-md w-full border border-fail/30">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-fail/30 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={22} className="text-fail-text" />
        </div>
        <h1 className="text-2xl font-bold text-ink mb-2">Something went wrong</h1>
        <p className="text-slate-400 text-sm mb-7">
          An unexpected error stopped this page from loading. You can try again, or head back
          home and pick up where you left off.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={reset} className="btn-primary justify-center">
            <RefreshCw size={16} />
            Try again
          </button>
          <Link href="/" className="btn-secondary justify-center">
            Back to home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-[11px] text-slate-600">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  )
}
