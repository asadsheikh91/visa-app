import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CountryComparison } from '@/components/landing/CountryComparison'

export const metadata: Metadata = {
  title: 'Compare Study Destinations — ParchiVisa',
  description:
    'Compare tuition, monthly living costs, work-hour limits, PR pathway difficulty, and visa processing times across the UK, USA, Canada, and Australia.',
}

export default function ComparePage() {
  return (
    <div className="min-h-screen pt-24 sm:pt-28">
      <div className="container-inner px-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-support transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to home
        </Link>
      </div>

      {/* The section provides its own heading, content, and bottom checker CTA. */}
      <CountryComparison />
    </div>
  )
}
