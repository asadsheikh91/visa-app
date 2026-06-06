'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Sparkles, X } from 'lucide-react'
import clsx from 'clsx'
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Tools', href: '/tools' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Reviews', href: '/reviews' },
]

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <header
      className={clsx(
        'fixed left-0 right-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-white/[0.08] bg-surface-950/90 shadow-xl shadow-black/20 backdrop-blur-xl'
          : 'bg-transparent'
      )}
    >
      <div className="mx-auto max-w-[1440px] px-6 sm:px-10 lg:px-20">
        <div className="relative flex h-20 items-center justify-between">
          <Link href="/" className="group flex flex-shrink-0 items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#673BFF] via-[#A13CFF] to-[#FF6A2A] shadow-lg shadow-brand-900/40 transition-all duration-200 group-hover:shadow-brand-700/50">
              <Sparkles size={19} className="text-white" fill="white" />
            </span>
            <span className="text-2xl font-bold tracking-tight text-white">
              ParchiVisa
            </span>
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 md:flex" aria-label="Main navigation">
            {navLinks.map((link) => {
              const active = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'rounded-lg px-1 py-2 text-base font-medium transition-all duration-150',
                    active ? 'text-white' : 'text-slate-100/90 hover:text-white'
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <DesktopAuth />

          <div className="flex items-center gap-3 md:hidden">
            {CLERK_ENABLED && (
              <SignedIn>
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{ elements: { avatarBox: 'w-7 h-7 ring-2 ring-brand-500/40' } }}
                />
              </SignedIn>
            )}
            <button
              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-white/[0.08] hover:text-white"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      <div
        className={clsx(
          'overflow-hidden transition-all duration-300 md:hidden',
          menuOpen ? 'max-h-[520px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="space-y-1 border-b border-white/[0.08] bg-surface-950/[0.97] px-4 pb-5 pt-2 backdrop-blur-xl">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-white/[0.06] hover:text-white"
            >
              {link.label}
            </Link>
          ))}
          <MobileAuth />
        </div>
      </div>
    </header>
  )
}

function DesktopAuth() {
  if (!CLERK_ENABLED) {
    return (
      <div className="hidden items-center gap-3 md:flex">
        <Link
          href="/sign-in"
          className="rounded-xl border border-white/20 px-7 py-3 text-base font-medium text-white transition-all hover:border-white/35 hover:bg-white/5"
        >
          Sign In
        </Link>
        <Link href="/tools/student-visa/countries" className="btn-primary hover-glow px-7 py-3 text-base">
          Get Started
        </Link>
      </div>
    )
  }

  return (
    <div className="hidden items-center gap-3 md:flex">
      <SignedOut>
        <SignInButton mode="modal">
          <button className="rounded-xl border border-white/20 px-7 py-3 text-base font-medium text-white transition-all hover:border-white/35 hover:bg-white/5">
            Sign In
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="btn-primary hover-glow px-7 py-3 text-base">Get Started</button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <Link
          href="/dashboard"
          className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:border-white/30 hover:bg-white/5"
        >
          Dashboard
        </Link>
        <Link href="/tools/student-visa/countries" className="btn-primary hover-glow px-7 py-3 text-base">
          Check Readiness
        </Link>
        <UserButton
          afterSignOutUrl="/"
          appearance={{ elements: { avatarBox: 'w-8 h-8 ring-2 ring-brand-500/40 hover:ring-brand-500/70 transition-all' } }}
        />
      </SignedIn>
    </div>
  )
}

function MobileAuth() {
  if (!CLERK_ENABLED) {
    return (
      <div className="mt-2 space-y-2 border-t border-white/[0.08] pt-3">
        <Link
          href="/sign-in"
          className="block rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-medium text-slate-300"
        >
          Sign In
        </Link>
        <Link href="/tools/student-visa/countries" className="btn-primary w-full justify-center text-sm">
          Get Started
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2 border-t border-white/[0.08] pt-3">
      <SignedOut>
        <SignInButton mode="modal">
          <button className="w-full rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-medium text-slate-300">
            Sign In
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="btn-primary w-full justify-center text-sm">Get Started</button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <Link
          href="/dashboard"
          className="block rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-medium text-slate-300"
        >
          Dashboard
        </Link>
        <Link href="/tools/student-visa/countries" className="btn-primary w-full justify-center text-sm">
          Check Readiness
        </Link>
      </SignedIn>
    </div>
  )
}
