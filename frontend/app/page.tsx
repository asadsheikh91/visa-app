import { HeroSection } from '@/components/landing/HeroSection'
import { StatsStrip } from '@/components/landing/StatsStrip'
import { StorySection } from '@/components/landing/StorySection'
import { FeatureSection } from '@/components/landing/FeatureSection'
import { TestimonialSection } from '@/components/landing/TestimonialSection'
import { FinalCTA } from '@/components/landing/FinalCta'

/**
 * ParchiVisa landing page.
 *
 * Reads top-to-bottom as one story: the fear of an avoidable refusal (Hero),
 * the credibility behind us (Stats), every place a visa goes wrong and the
 * module that catches it (Story), why our engine can be trusted (Features),
 * proof from real students (Testimonial), and the call to act (Final CTA).
 * The Footer is rendered globally in app/layout.tsx.
 */
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <StatsStrip />
      <StorySection />
      <FeatureSection />
      <TestimonialSection />
      <FinalCTA />
    </>
  )
}
