import { LandingNav } from '@/components/landing/paper/LandingNav'
import { Hero } from '@/components/landing/paper/Hero'
import { FailureClauses } from '@/components/landing/paper/FailureClauses'
import { pvSerif, pvSans, pvMono } from './pv-fonts'

/**
 * ParchiVisa landing — "The Official Document."
 * parchi = a slip of paper (Urdu): ink, paper, stamps. The wrapper scopes the
 * pv font variables and triggers globals.css to swap the global dark chrome
 * for this route's own paper-styled Nav/Footer.
 *
 * Sections are being rebuilt one at a time; the old dark landing components
 * in components/landing/ are superseded by components/landing/paper/.
 */
export default function HomePage() {
  return (
    <div
      data-pv-landing=""
      className={`${pvSerif.variable} ${pvSans.variable} ${pvMono.variable} min-h-screen bg-paper font-body text-ink antialiased`}
    >
      <LandingNav />
      <Hero />
      <FailureClauses />
    </div>
  )
}
