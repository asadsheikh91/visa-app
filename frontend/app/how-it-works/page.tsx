import { Metadata } from 'next'
import { HowItWorksSection } from '@/components/sections/HowItWorksSection'
import { BenefitsSection } from '@/components/sections/BenefitsSection'

export const metadata: Metadata = {
  title: 'How It Works — ParchiVisa',
  description: 'How ParchiVisa reviews your profile and documents to produce a student visa readiness score with clear gaps to fix before you apply.',
}

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen pt-16">
      <HowItWorksSection />
      <BenefitsSection />
    </div>
  )
}
