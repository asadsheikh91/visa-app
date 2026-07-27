import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Section } from '@/components/landing/paper/Section'
import { RULES_UPDATED_LABEL } from '@/content/site-config'

export const metadata: Metadata = {
  title: 'About — ParchiVisa',
  description:
    'What ParchiVisa actually does: we read your student visa file against the official UK, Australia, Canada and USA rules, score its readiness, and name every gap while you can still fix it.',
}

const CHECKER_HREF = '/tools/student-visa/countries'

// TODO(content): replace with the real published address before launch. It is
// referenced here, in components/Footer.tsx and in LandingFooter.tsx — change
// all three together.
const CONTACT_EMAIL = 'hello@parchivisa.com'

/* ── What we do — the concrete mechanics, not adjectives ────────────────── */
const whatWeDo: { ref: string; title: string; body: string }[] = [
  {
    ref: '01',
    title: 'We read the official rules, so you don’t have to',
    body: 'UKVI, IRCC, Home Affairs and the US State Department publish the requirements — in thousands of words, across dozens of pages, changing without notice. We track them and keep the thresholds, hold periods and validity windows current.',
  },
  {
    ref: '02',
    title: 'We test your file against them',
    body: 'You answer a short questionnaire about your course, your funding and your history. Every answer is checked against the rules for your exact route — not a generic checklist, and not an opinion.',
  },
  {
    ref: '03',
    title: 'We give you a readiness score and name every gap',
    body: 'You get a number, the reasoning behind it, and a specific list of what is weak or missing — each item traced back to the rule it comes from, with a link to the source.',
  },
  {
    ref: '04',
    title: 'We tell you what to fix, in the order that matters',
    body: 'Some fixes take a day. Some, like the 28-day financial hold, take a month. The plan is ordered so the slow ones start first — which is the entire point of checking early.',
  },
]

/* ── The honesty block. This is the differentiator, so it is stated plainly ── */
const whatWeAreNot: string[] = [
  'We are not an agent or a consultancy. We do not file your application, book your appointments, or speak to any embassy on your behalf.',
  'We take no commission from any university, college or recruiter. Nobody pays us to point you somewhere.',
  'We do not guarantee a visa, and we never will. No honest tool can — the decision belongs to a case officer.',
  'We are not affiliated with, endorsed by, or acting for any government, embassy or high commission.',
]

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-16">
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <Section aria-labelledby="about-heading" tone="paper" railed>
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-support">
          About ParchiVisa
        </p>
        <h1
          id="about-heading"
          className="mt-5 max-w-[20ch] text-balance font-serif text-[38px] font-medium leading-[1.08] tracking-[-0.015em] text-ink sm:text-[48px]"
        >
          We read your file the way a case officer <em className="italic">will</em>.
        </h1>
        <p className="measure mt-6 font-body text-[17px] leading-relaxed text-support">
          A refused student visa costs a non-refundable fee, a lost intake and, often, a year.
          Most refusals are not bad luck — they are documented, repeatable mistakes that were
          fixable weeks earlier. ParchiVisa exists to find yours while there is still time.
        </p>
        <p className="measure mt-4 font-body text-[17px] font-medium leading-relaxed text-ink">
          <em className="font-serif italic">parchi</em> — Urdu for a slip of paper. The thing your
          whole application comes down to.
        </p>
      </Section>

      {/* ── What we do ───────────────────────────────────────────────────── */}
      <Section aria-labelledby="do-heading" tone="paper-alt" railed>
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-support">
          What we do
        </p>
        <h2
          id="do-heading"
          className="mt-4 max-w-[24ch] font-serif text-[30px] font-medium leading-[1.12] tracking-[-0.01em] text-ink sm:text-[36px]"
        >
          Four things, done properly.
        </h2>

        <div className="mt-12 max-w-[900px]">
          {whatWeDo.map((item) => (
            <article key={item.ref} className="border-t border-hairline py-7">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[68px_1fr] sm:gap-8">
                <div className="pt-[5px] font-mono text-[12px] font-bold tracking-[0.08em] text-support">
                  {item.ref}
                </div>
                <div>
                  <h3 className="font-serif text-[21px] font-medium leading-snug text-ink">
                    {item.title}
                  </h3>
                  <p className="measure mt-2 font-body text-[15px] leading-relaxed text-support">
                    {item.body}
                  </p>
                </div>
              </div>
            </article>
          ))}
          <div aria-hidden="true" className="h-px bg-hairline" />
        </div>

        <p className="mt-8 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-support">
          Rules tracked for UK · Australia · Canada · USA &ensp;·&ensp; {RULES_UPDATED_LABEL}
        </p>
      </Section>

      {/* ── What we are not ──────────────────────────────────────────────── */}
      <Section aria-labelledby="not-heading" tone="paper" railed>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-support">
              Where we stop
            </p>
            <h2
              id="not-heading"
              className="mt-4 font-serif text-[30px] font-medium leading-[1.12] tracking-[-0.01em] text-ink sm:text-[36px]"
            >
              What we are <em className="italic">not</em>.
            </h2>
            <p className="mt-5 max-w-[34ch] font-body text-[15px] leading-relaxed text-support">
              This market runs on people promising things they cannot deliver. Here is our
              boundary, in writing.
            </p>
          </div>

          <div className="lg:col-span-8">
            <ul className="border border-ink bg-white shadow-[6px_6px_0_0] shadow-ink/10">
              {whatWeAreNot.map((line, i) => (
                <li
                  key={line}
                  className={`flex items-start gap-4 px-6 py-5 sm:px-7 ${
                    i > 0 ? 'border-t border-hairline' : ''
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="mt-[2px] font-mono text-[13px] font-bold text-fail-text"
                  >
                    ✕
                  </span>
                  <span className="font-body text-[15px] leading-relaxed text-support">{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-support">
              ParchiVisa is an informational readiness check. It is not immigration advice.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Contact ──────────────────────────────────────────────────────── */}
      <Section aria-labelledby="contact-heading" tone="paper-alt" railed>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-support">
              Contact us
            </p>
            <h2
              id="contact-heading"
              className="mt-4 font-serif text-[30px] font-medium leading-[1.12] tracking-[-0.01em] text-ink sm:text-[36px]"
            >
              Talk to a person.
            </h2>
          </div>

          <div className="lg:col-span-8">
            <div className="border border-ink bg-white p-7 shadow-[6px_6px_0_0] shadow-ink/10 sm:p-9">
              <p className="measure font-body text-[15px] leading-relaxed text-support">
                Questions about your result, a rule you think we have wrong, press, or partnership
                — write to us and a human will answer.
              </p>

              <dl className="mt-7 border-t border-hairline pt-6">
                <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-support">
                  Email
                </dt>
                <dd className="mt-2">
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="font-mono text-[18px] text-ink underline decoration-hairline underline-offset-4 transition-colors hover:decoration-stamp sm:text-[20px]"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </dd>
              </dl>

              <p className="mt-6 font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-support">
                We reply to everything, usually within two working days.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Close ────────────────────────────────────────────────────────── */}
      <Section aria-labelledby="about-cta-heading" tone="ink">
        <div className="mx-auto max-w-[720px] text-center">
          <h2
            id="about-cta-heading"
            className="mx-auto max-w-[20ch] text-balance font-serif text-[32px] font-medium leading-[1.1] tracking-[-0.015em] text-paper sm:text-[40px]"
          >
            The embassy reads your file once. <em className="italic">Read it first.</em>
          </h2>
          <div className="mt-9">
            <Link
              href={CHECKER_HREF}
              className="inline-flex items-center gap-2 rounded-[3px] border border-paper/25 bg-stamp px-7 py-4 font-body text-[15px] font-semibold text-paper transition-colors hover:bg-stamp-deep"
            >
              Check my readiness — free
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Section>
    </div>
  )
}
