import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { RejectionReasons } from '@/components/landing/RejectionReasons'

export const metadata: Metadata = {
  title: 'Why Student Visas Get Refused — ParchiVisa',
  description:
    'The most commonly documented reasons Pakistani students are refused a UK, USA, Canada, or Australia student visa — and what to fix before you apply.',
}

export default function WhyRejectedPage() {
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

      {/* The section provides its own heading, tabs, and bottom checker CTA. */}
      <RejectionReasons />
    </div>
  )
}
