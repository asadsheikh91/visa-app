import Link from 'next/link'
import { Instagram, Linkedin } from 'lucide-react'
import { BrandSeal } from '@/components/BrandSeal'

/**
 * Landing-scoped footer — quiet paper-deep close. Link inventory mirrors the
 * global Footer so nothing reachable from the old landing is lost. No motion.
 */
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

export function LandingFooter() {
  return (
    <footer className="border-t border-hairline bg-paper-deep">
      <div className="mx-auto max-w-content px-gutter py-band">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link href="/" className="flex items-center gap-2.5" aria-label="ParchiVisa home">
              <BrandSeal className="h-11 w-11" />
              <span className="font-serif text-[20px] leading-none tracking-tight text-ink">
                Parchi<em className="italic">Visa</em>
              </span>
            </Link>
            <p className="mt-4 max-w-[36ch] font-body text-[14px] leading-relaxed text-support">
              We catch the fixable mistakes before the embassy does.
            </p>
            <div className="mt-6 flex gap-4">
              <a
                href="https://www.linkedin.com/company/parchivisa"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="ParchiVisa on LinkedIn"
                className="text-support transition-colors hover:text-ink"
              >
                <Linkedin className="h-[18px] w-[18px]" />
              </a>
              <a
                href="https://www.instagram.com/parchi.visa/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="ParchiVisa on Instagram"
                className="text-support transition-colors hover:text-ink"
              >
                <Instagram className="h-[18px] w-[18px]" />
              </a>
            </div>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className="md:col-span-2">
              <h3 className="font-mono text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-body text-[13.5px] text-support transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Persistent disclaimer — full text, on every page (also repeated
            directly under the hero CTA). Every claim on the site stays inside
            what the tool actually does. */}
        <p className="mt-14 max-w-[70ch] border-t border-hairline pt-6 font-body text-[12px] leading-relaxed text-support">
          ParchiVisa is an independent tool. Not affiliated with or endorsed by any government,
          embassy or high commission. This is not immigration advice.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-support">
            © 2026 ParchiVisa · All rights reserved
          </p>
          {/* TODO(content): add a full WhatsApp click-to-chat contact line here
              (real number) — required trust signal for this market. */}
        </div>
      </div>
    </footer>
  )
}
