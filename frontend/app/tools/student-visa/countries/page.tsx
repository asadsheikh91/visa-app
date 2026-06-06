import { Metadata } from 'next'
import { CheckerHeader } from '@/components/checker/CheckerHeader'
import { CountrySelector } from '@/components/checker/CountrySelector'
import { AuthGate } from '@/components/auth/AuthGate'

export const metadata: Metadata = {
  title: 'Choose a Country — Student Visa Readiness Checker — ParchiVisa',
  description: 'Select your destination country to run the Student Visa Readiness Checker for the UK, USA, Canada, or Australia.',
}

export default function CountriesPage() {
  return (
    <div className="min-h-screen pt-16">
      <CheckerHeader
        title="Student Visa Readiness Checker"
        subtitle="UK · USA · Canada · Australia — get your readiness score in minutes"
        backHref="/tools/student-visa"
        backLabel="Back to overview"
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <AuthGate>
          <CountrySelector />
        </AuthGate>
      </div>
    </div>
  )
}
