import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { LandingNav } from '@/components/landing/paper/LandingNav'
import { LandingFooter } from '@/components/landing/paper/LandingFooter'
import { Section } from '@/components/landing/paper/Section'
import { pvSerif, pvSans, pvMono } from '../pv-fonts'

export const metadata: Metadata = {
  title: 'What changed — ParchiVisa',
  description:
    'Why Pakistani student visa refusals rose and why some UK universities have paused applications — and what it means for your file.',
}

// TODO(content): stub page linked from the news strip (brief section 1).
// Replace with a fully sourced editorial writeup before the 41%/nine-university
// figures are updated again — every claim here needs a dated citation.
export default function WhyVisasFailPage() {
  return (
    <div
      data-pv-landing=""
      className={`${pvSerif.variable} ${pvSans.variable} ${pvMono.variable} min-h-screen bg-paper font-body text-ink antialiased`}
    >
      <LandingNav />
      <Section as="article" tone="paper" width="content">
        <div className="mx-auto max-w-[70ch]">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-support">
            What changed
          </p>
          <h1 className="mt-4 text-balance font-serif text-[32px] font-medium leading-[1.1] tracking-[-0.015em] text-ink sm:text-[40px]">
            Why the refusal rate moved, and what it means for your file.
          </h1>

          <p className="measure mt-6 font-body text-[17px] leading-relaxed text-support">
            Pakistani student visa refusals rose sharply in the last intake, and a number of UK
            universities have paused new applications from Pakistani students while they review
            their intake pipeline. Neither change is about any one applicant — both are downstream
            of a pattern the same rules-based checks in ParchiVisa are built to catch: incomplete
            financial evidence, documents that fall outside the required validity window, and gaps
            in an applicant&rsquo;s study or work history that go unexplained.
          </p>
          <p className="measure mt-4 font-body text-[17px] leading-relaxed text-support">
            None of this means an application is doomed. It means the margin for a file with
            avoidable gaps has narrowed. A readiness check does not change the rules — it shows you,
            before you submit, exactly where your file doesn&rsquo;t yet meet them.
          </p>

          <p className="measure mt-4 font-body text-[12px] leading-relaxed text-support">
            This page is a plain-language summary, not immigration advice. Figures are reviewed
            quarterly against official sources.
          </p>

          <Link
            href="/tools/student-visa/countries"
            className="mt-8 inline-flex items-center gap-2 rounded-[3px] bg-stamp px-6 py-3.5 font-body text-[15px] font-semibold text-paper transition-colors hover:bg-stamp-deep"
          >
            Get my readiness score
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </Section>
      <LandingFooter />
    </div>
  )
}
