import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const countries = [
  { slug: 'uk', code: 'UK', name: 'United Kingdom', route: 'Student Route' },
  { slug: 'usa', code: 'US', name: 'United States', route: 'F-1 Visa' },
  { slug: 'canada', code: 'CA', name: 'Canada', route: 'Study Permit' },
  { slug: 'australia', code: 'AU', name: 'Australia', route: 'Subclass 500' },
]

export function CountryCTA() {
  return (
    <section className="relative z-10 px-4 py-20 sm:py-24" aria-labelledby="country-cta-heading">
      <div className="mx-auto max-w-4xl text-center">
        <p className="section-label mb-3">Start your check</p>
        <h2 id="country-cta-heading" className="mb-3 text-2xl font-bold text-white sm:text-3xl">
          Where are you applying to study?
        </h2>
        <p className="mx-auto mb-10 max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
          Pick your destination and get a country-specific readiness score in minutes.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {countries.map(({ slug, code, name, route }) => (
            <Link
              key={slug}
              href={`/tools/student-visa/countries/${slug}`}
              className="group glass hover-lift rounded-2xl p-5 text-left hover:border-brand-500/40"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xs font-bold tracking-widest text-brand-200">
                {code}
              </span>
              <p className="mt-4 text-sm font-semibold text-white">{name}</p>
              <p className="text-xs text-slate-500">{route}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-300 transition-all group-hover:gap-2">
                Check readiness <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <Link href="/tools/student-visa/countries" className="btn-primary hover-glow">
            Check My Readiness
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}
