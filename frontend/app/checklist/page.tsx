import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DocumentChecklist } from '@/components/landing/DocumentChecklist'

export const metadata: Metadata = {
  title: 'Student Visa Document Checklist — ParchiVisa',
  description:
    'An interactive document checklist for UK, USA, Canada, and Australia student visa applications — tick off what you have ready.',
}

export default function ChecklistPage() {
  return (
    <div className="min-h-screen pt-24 sm:pt-28">
      <div className="container-inner px-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to home
        </Link>
      </div>

      {/* The section provides its own heading, tabs, and bottom checker CTA. */}
      <DocumentChecklist />
    </div>
  )
}
