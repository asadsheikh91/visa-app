import Link from 'next/link'
import { Compass, ArrowRight } from 'lucide-react'

/**
 * Branded 404. Rendered inside the root layout, so the Navbar/Footer remain.
 * Keeps a lost visitor on a clear path back to the core funnel.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen pt-24 flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 sm:p-10 text-center max-w-md w-full">
        <div className="w-12 h-12 rounded-2xl bg-[#ff5a1f]/10 border border-[#ff5a1f]/25 flex items-center justify-center mx-auto mb-5">
          <Compass size={22} className="text-[#ff5a1f]" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff7a3c] mb-2">
          404 — Page not found
        </p>
        <h1 className="text-2xl font-bold text-white mb-2">This page took a wrong turn</h1>
        <p className="text-slate-400 text-sm mb-7">
          The page you’re looking for doesn’t exist or may have moved. Let’s get you back on track.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn-secondary justify-center">
            Back to home
          </Link>
          <Link href="/tools/student-visa/countries" className="btn-primary justify-center">
            Check my eligibility
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  )
}
