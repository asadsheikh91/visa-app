import { Metadata } from 'next'
import { CheckerHeader } from '@/components/checker/CheckerHeader'
import { CountryChecker } from '@/components/checker/CountryChecker'
import { ProofOfFundsConverter } from '@/components/checker/ProofOfFundsConverter'
import { AuthGate } from '@/components/auth/AuthGate'
import { COUNTRY_CURRENCY } from '@/lib/currency'
import type { CountrySlug } from '@/lib/countries'

const COUNTRY_NAMES: Record<string, { name: string; route: string }> = {
  uk: { name: 'United Kingdom', route: 'Student Visa' },
  usa: { name: 'United States', route: 'F-1 Student Visa' },
  canada: { name: 'Canada', route: 'Study Permit' },
  australia: { name: 'Australia', route: 'Student Visa Subclass 500' },
}

export function generateMetadata({ params }: { params: { country: string } }): Metadata {
  const meta = COUNTRY_NAMES[params.country?.toLowerCase()]
  const name = meta?.name || 'Student Visa'
  return {
    title: `${name} Student Visa Readiness — ParchiVisa`,
    description: `Check your readiness for a ${name} student visa and get a score with specific gaps and recommendations.`,
  }
}

export default function CountryCheckerPage({ params }: { params: { country: string } }) {
  const slug = (params.country || '').toLowerCase()
  const meta = COUNTRY_NAMES[slug]
  const title = meta ? `${meta.name} — Readiness Checker` : 'Student Visa Readiness Checker'
  const subtitle = meta ? meta.route : 'Answer a few questions to get your readiness score'

  return (
    <div className="min-h-screen pt-16">
      <CheckerHeader
        title={title}
        subtitle={subtitle}
        backHref="/tools/student-visa/countries"
        backLabel="Back to countries"
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <AuthGate>
          <CountryChecker country={slug} />
        </AuthGate>

        {/* Visa-readiness helper: convert PKR funds to the destination currency
            for proof-of-funds comparison. Independent of the checker/scoring. */}
        {slug in COUNTRY_CURRENCY && (
          <ProofOfFundsConverter country={slug as CountrySlug} />
        )}
      </div>
    </div>
  )
}
