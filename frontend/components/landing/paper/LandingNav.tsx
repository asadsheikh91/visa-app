'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { StampMark } from './StampMark'

const CHECKER_HREF = '/tools/student-visa/countries'

const navLinks = [
  { label: 'Why visas fail', href: '/#failures' },
  { label: 'Coverage', href: '/#coverage' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'For agencies', href: '/consultant' },
  { label: 'About', href: '/about' },
]

/**
 * Landing-scoped nav ("The Official Document" redesign).
 * Solid paper, hairline rule, one green CTA. The 3px ink top edge is the
 * gov-site convention — a quiet institutional cue.
 */
export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-t-[3px] border-t-ink border-b border-b-hairline bg-paper">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between px-gutter">
        <Link href="/" className="flex items-center gap-2.5" aria-label="ParchiVisa home">
          <StampMark className="h-8 w-8 -rotate-[8deg] text-stamp" />
          <span className="font-serif text-[21px] leading-none tracking-tight text-ink">
            Parchi<em className="italic">Visa</em>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-body text-sm font-medium text-support transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-6 lg:flex">
          <Link
            href="/sign-in"
            className="font-body text-sm font-medium text-support transition-colors hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href={CHECKER_HREF}
            className="rounded-[3px] bg-stamp px-4 py-2 font-body text-sm font-semibold text-paper transition-colors hover:bg-stamp-deep"
          >
            Check readiness
          </Link>
        </div>

        <button
          type="button"
          className="-mr-1 p-2 text-ink lg:hidden"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-hairline bg-paper px-5 pb-5 pt-2 lg:hidden">
          <nav className="flex flex-col" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border-b border-hairline py-3 font-body text-[15px] font-medium text-ink"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/sign-in"
              className="border-b border-hairline py-3 font-body text-[15px] font-medium text-support"
              onClick={() => setMenuOpen(false)}
            >
              Sign in
            </Link>
          </nav>
          <Link
            href={CHECKER_HREF}
            className="mt-4 block rounded-[3px] bg-stamp px-4 py-2.5 text-center font-body text-sm font-semibold text-paper"
            onClick={() => setMenuOpen(false)}
          >
            Check readiness
          </Link>
        </div>
      )}
    </header>
  )
}
