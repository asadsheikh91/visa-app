import type { ComponentType, SVGProps } from 'react'
import Link from 'next/link'
import { Instagram, Linkedin } from 'lucide-react'
import { BrandSeal } from '@/components/BrandSeal'

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Check Eligibility', href: '/tools/student-visa/countries' },
      { label: 'Visa Rules', href: '/why-rejected' },
      { label: 'Documentation', href: '/checklist' },
      { label: 'Guides', href: '/compare' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Use', href: '/terms' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
      // Site is served at parchivisa.app; parchivisa.com is not registered.
      // See the CONTACT_EMAIL note in app/about/page.tsx.
      { label: 'Contact Us', href: 'mailto:hello@parchivisa.app' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
]

const socials: { label: string; href: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/parchivisa', icon: Linkedin },
  { label: 'Instagram', href: 'https://www.instagram.com/parchi.visa/', icon: Instagram },
]

/**
 * Global app footer — "The Official Document" paper theme (mirrors the landing
 * LandingFooter). Paper-deep ground, mono column heads, ink links, the
 * persistent independence disclaimer. Hidden on the landing route, which
 * renders its own LandingFooter.
 */
export function Footer() {
  return (
    <footer className="border-t border-hairline bg-paper-deep">
      <div className="mx-auto max-w-content px-gutter py-16">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-[1.4fr_repeat(3,1fr)_1.2fr]">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="flex w-fit items-center gap-2.5" aria-label="ParchiVisa home">
              <BrandSeal className="h-11 w-11" />
              <span className="font-serif text-[20px] leading-none tracking-tight text-ink">
                Parchi<em className="italic">Visa</em>
              </span>
            </Link>
            <p className="mt-4 max-w-[240px] font-body text-sm leading-relaxed text-support">
              We catch the fixable mistakes before the embassy does. No guesswork, no agents —
              just your real readiness, in ink.
            </p>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-support">
              © {new Date().getFullYear()} ParchiVisa · All rights reserved
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h4 className="font-mono text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-body text-[13.5px] text-support transition-colors duration-150 hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Follow Us */}
          <div className="col-span-2 sm:col-span-1">
            <h4 className="font-mono text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink">
              Follow Us
            </h4>
            <div className="mt-4 flex flex-wrap gap-3">
              {socials.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-hairline bg-paper text-support transition-colors duration-200 hover:border-stamp hover:text-stamp"
                >
                  <Icon width={16} height={16} aria-hidden />
                </a>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-14 max-w-[70ch] border-t border-hairline pt-6 font-body text-[12px] leading-relaxed text-support">
          ParchiVisa is an independent tool. Not affiliated with, endorsed by, or acting on behalf
          of any government, embassy, or high commission. This is not immigration advice.
        </p>
      </div>
    </footer>
  )
}
