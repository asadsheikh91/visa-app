'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Menu, X } from 'lucide-react'
import clsx from 'clsx'
import { SignedIn, UserButton } from '@clerk/nextjs'
import { CurrencyConverterWidget } from '@/components/currency/CurrencyConverterWidget'
import { BrandLogo } from '@/components/BrandLogo'

const navLinks = [
  { label: 'Check Eligibility', href: '/tools/student-visa/countries' },
  { label: 'Visa Rules', href: '/why-rejected' },
  { label: 'Documentation', href: '/checklist' },
  { label: 'Guides', href: '/compare' },
  { label: 'For Agencies', href: '/consultant' },
  { label: 'About Us', href: '/about' },
]

const CHECKER_HREF = '/tools/student-visa/countries'
const DASHBOARD_HREF = '/dashboard'
const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

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
        'fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300',
        scrolled
          ? 'border-white/[0.08] bg-[#0a0908]/90 shadow-lg shadow-black/30 backdrop-blur-xl'
          : 'border-white/[0.06] bg-[#0a0908]/60 backdrop-blur-md'
      )}
    >
      <div className="mx-auto max-w-[1440px] px-5 sm:px-6 lg:px-8">
        <div className="flex h-[72px] items-center justify-between gap-8 lg:gap-12">
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
                    'whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-150',
                    active
                      ? 'text-white'
                      : 'text-slate-300/80 hover:bg-white/[0.05] hover:text-white'
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
              className="rounded-full border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06]"
            >
              Dashboard
            </Link>
            <Link href={CHECKER_HREF} className="btn-orange">
              Check My Eligibility
              <ArrowRight size={16} />
            </Link>
            {CLERK_ENABLED && (
              <SignedIn>
                {onDashboard && (
                  <>
                    <CurrencyConverterWidget />
                    <span className="mx-1 h-7 w-px bg-white/10" aria-hidden />
                  </>
                )}
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{ elements: { avatarBox: 'w-8 h-8 ring-2 ring-[#ff5a1f]/40 hover:ring-[#ff5a1f]/70 transition-all' } }}
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
                  appearance={{ elements: { avatarBox: 'w-7 h-7 ring-2 ring-[#ff5a1f]/40' } }}
                />
              </SignedIn>
            )}
            <button
              type="button"
              className="rounded-full border border-white/[0.1] p-2 text-slate-300 transition-all hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      <div
        className={clsx(
          'overflow-hidden transition-all duration-300 lg:hidden',
          menuOpen ? 'max-h-[560px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="space-y-1 border-t border-white/[0.06] bg-[#0a0908]/95 px-4 pb-6 pt-3 backdrop-blur-xl">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-full px-4 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-white/[0.06] hover:text-white"
            >
              {link.label}
            </Link>
          ))}

          <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-4">
            <Link
              href={DASHBOARD_HREF}
              className="block rounded-full border border-white/[0.12] bg-white/[0.03] px-4 py-3 text-center text-sm font-medium text-slate-200 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
            >
              Dashboard
            </Link>
            <Link href={CHECKER_HREF} className="btn-orange w-full justify-center py-3">
              Check My Eligibility
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

function Brand() {
  return (
    <Link href="/" className="group flex flex-shrink-0 items-center" aria-label="ParchiVisa home">
      <BrandLogo className="h-9 w-auto transition-all duration-200 group-hover:drop-shadow-[0_0_10px_rgba(255,90,31,0.5)]" />
    </Link>
  )
}
