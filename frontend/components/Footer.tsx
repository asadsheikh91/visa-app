import type { ComponentType, SVGProps } from 'react'
import Link from 'next/link'
import { Instagram, Linkedin } from 'lucide-react'

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
      { label: 'Contact Us', href: 'mailto:hello@parchivisa.com' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
]

const socials: { label: string; href: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/parchivisa', icon: Linkedin },
  { label: 'Instagram', href: 'https://www.instagram.com/parchi.visa/', icon: Instagram },
]

export function Footer() {
  return (
    <footer className="relative border-t border-line-1 px-5 pb-10 pt-16 sm:px-8 lg:px-20">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-[1.4fr_repeat(3,1fr)_1.2fr]">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="flex w-fit items-center gap-3" aria-label="ParchiVisa home">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#ff5a1f] text-xs font-black text-[#ff5a1f] transition-all duration-200 hover:bg-[#ff5a1f]/10 hover:shadow-[0_0_14px_rgba(255,90,31,0.45)]">
                PV
              </span>
              <span className="text-base font-bold uppercase tracking-[0.22em] text-white">Parchivisa</span>
            </Link>
            <p className="mt-4 max-w-[240px] text-sm leading-relaxed text-slate-400">
              We catch the fixable mistakes before the embassy does. No guesswork, no agents — just
              your real readiness.
            </p>
            <p className="mt-6 text-xs text-slate-500">
              © {new Date().getFullYear()} ParchiVisa. All rights reserved.
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 transition-colors duration-150 hover:text-white"
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
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Follow Us</h4>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {socials.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-line-2 bg-tint-2 text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#ff5a1f]/50 hover:text-[#ff5a1f]"
                >
                  <Icon width={16} height={16} aria-hidden />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-line-1 pt-5">
          <p className="text-center text-xs text-slate-500 sm:text-left">
            Not affiliated with any government visa authority. For informational purposes only.
          </p>
        </div>
      </div>
    </footer>
  )
}
