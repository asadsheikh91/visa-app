'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Menu, X, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import { SignedIn, UserButton } from '@clerk/nextjs'
import { CurrencyConverterWidget } from '@/components/currency/CurrencyConverterWidget'
import { BrandSeal } from '@/components/BrandSeal'
import { useIsAdmin } from '@/lib/useAdminApi'

const navLinks = [
  { label: 'Check Eligibility', href: '/tools/student-visa/countries' },
  { label: 'Visa Rules', href: '/why-rejected' },
  { label: 'Documentation', href: '/checklist' },
  { label: 'Guides', href: '/compare' },
  // Agency workspace is withdrawn from the public site for now — the route is
  // also gated (see app/consultant/page.tsx). Restore this entry together with
  // the route gate when the B2B offering goes live.
  // { label: 'For Agencies', href: '/consultant' },
  { label: 'About Us', href: '/about' },
]

const CHECKER_HREF = '/tools/student-visa/countries'
const DASHBOARD_HREF = '/dashboard'
const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

/**
 * Global app chrome — "The Official Document" paper theme.
 * Solid paper ground, a 3px ink top edge (the gov-site convention), hairline
 * rule, one stamp-green CTA. The landing route renders its own LandingNav and
 * hides this via the body:has([data-pv-landing]) rule in globals.css.
 */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const onDashboard = pathname?.startsWith('/dashboard') ?? false

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <header
      className={clsx(
        'fixed inset-x-0 top-0 z-50 border-t-[3px] border-t-ink border-b bg-paper transition-shadow duration-300',
        scrolled ? 'border-b-hairline shadow-[0_1px_0_0] shadow-ink/5' : 'border-b-hairline'
      )}
    >
      <div className="mx-auto max-w-content px-gutter">
        <div className="flex h-16 items-center justify-between gap-8 lg:gap-12">
          <div className="flex-shrink-0">
            <Brand />
          </div>

          <nav
            className="hidden flex-1 items-center justify-center gap-6 xl:gap-8 lg:flex"
            aria-label="Main navigation"
          >
            {navLinks.map((link) => {
              const active = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'whitespace-nowrap font-body text-sm font-medium transition-colors duration-150',
                    active ? 'text-ink' : 'text-support hover:text-ink'
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="hidden flex-shrink-0 items-center gap-5 xl:gap-6 lg:flex">
            <Link
              href={DASHBOARD_HREF}
              className="font-body text-sm font-medium text-support transition-colors hover:text-ink"
            >
              Dashboard
            </Link>
            <Link
              href={CHECKER_HREF}
              className="inline-flex items-center gap-2 rounded-[3px] bg-stamp px-4 py-2 font-body text-sm font-semibold text-paper transition-colors hover:bg-stamp-deep"
            >
              Check My Eligibility
              <ArrowRight size={15} />
            </Link>
            {CLERK_ENABLED && (
              <SignedIn>
                <AdminNavLink />
                {onDashboard && (
                  <>
                    <CurrencyConverterWidget />
                    <span className="mx-1 h-7 w-px bg-hairline" aria-hidden />
                  </>
                )}
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{ elements: { avatarBox: 'w-8 h-8 ring-2 ring-stamp/40 hover:ring-stamp/70 transition-all' } }}
                />
              </SignedIn>
            )}
          </div>

          <div className="flex items-center gap-3 lg:hidden">
            {CLERK_ENABLED && (
              <SignedIn>
                {onDashboard && <CurrencyConverterWidget />}
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{ elements: { avatarBox: 'w-7 h-7 ring-2 ring-stamp/40' } }}
                />
              </SignedIn>
            )}
            <button
              type="button"
              className="-mr-1 p-2 text-ink"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-hairline bg-paper px-gutter pb-5 pt-2 lg:hidden">
          <nav className="flex flex-col" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border-b border-hairline py-3 font-body text-[15px] font-medium text-ink"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={DASHBOARD_HREF}
              className="border-b border-hairline py-3 font-body text-[15px] font-medium text-support"
            >
              Dashboard
            </Link>
          </nav>
          <Link
            href={CHECKER_HREF}
            className="mt-4 flex items-center justify-center gap-2 rounded-[3px] bg-stamp px-4 py-2.5 font-body text-sm font-semibold text-paper"
          >
            Check My Eligibility
            <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </header>
  )
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="ParchiVisa home">
      <BrandSeal className="h-10 w-10" />
      <span className="font-serif text-[21px] leading-none tracking-tight text-ink">
        Parchi<em className="italic">Visa</em>
      </span>
    </Link>
  )
}

/**
 * Admin link — only rendered for allowlisted admins (backend /api/admin/me).
 * Mounted inside <SignedIn> so the Clerk-backed hook only runs when Clerk is
 * configured. Mount is authorization convenience only; the API enforces access.
 */
function AdminNavLink() {
  const { isAdmin } = useIsAdmin()
  if (!isAdmin) return null
  return (
    <Link
      href="/admin"
      className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-support transition-colors hover:text-ink"
    >
      <ShieldCheck size={15} />
      Admin
    </Link>
  )
}
