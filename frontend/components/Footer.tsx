import Link from 'next/link'
import { Github, Linkedin, Mail, Twitter, Zap } from 'lucide-react'
import { SignUpButton, SignedIn, SignedOut } from '@clerk/nextjs'

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

const footerLinks = {
  Product: [
    { label: 'Student Visa Checker', href: '/tools/student-visa/countries', disabled: false },
    { label: 'All Tools', href: '/tools', disabled: false },
    { label: 'Tourist Visa', href: '#', disabled: true },
    { label: 'Business Visa', href: '#', disabled: true },
  ],
  Company: [
    { label: 'About Us', href: '/about', disabled: false },
    { label: 'How It Works', href: '/how-it-works', disabled: false },
    { label: 'Blog', href: '#', disabled: true },
    { label: 'Contact', href: 'mailto:hello@parchivisa.com', disabled: false },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '#', disabled: true },
    { label: 'Terms of Service', href: '#', disabled: true },
    { label: 'Cookie Policy', href: '#', disabled: true },
    { label: 'Disclaimer', href: '#', disabled: true },
  ],
}

const socials = [
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Github, href: '#', label: 'GitHub' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Mail, href: 'mailto:hello@parchivisa.com', label: 'Email' },
]

export function Footer() {
  return (
    <footer>
      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(103,59,255,0.22), rgba(161,60,255,0.10), rgba(255,106,42,0.10), rgba(103,59,255,0.20))',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
          <p className="section-label">Start free today</p>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Know before you apply.</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
            Run your first readiness check in under 5 minutes. No credit card, no approval promises.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <FooterPrimaryCta />
            <Link href="/tools" className="btn-secondary px-6 py-3 text-sm">
              Explore Tools
            </Link>
          </div>
        </div>
      </div>

      <div className="divider" />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
          <div className="col-span-2 space-y-4 md:col-span-1">
            <Link href="/" className="flex w-fit items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-accent-500 to-orange-500">
                <Zap size={15} className="text-white" fill="white" />
              </span>
              <span className="text-lg font-bold">
                <span className="gradient-text">Parchi</span>
                <span className="text-white">Visa</span>
              </span>
            </Link>
            <p className="max-w-[220px] text-sm leading-relaxed text-slate-500">
              Helping visa applicants understand their readiness before submitting.
            </p>
            <div className="flex items-center gap-2 pt-1">
              {socials.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-500 transition-all duration-150 hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group} className="space-y-4">
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{group}</h4>
              <ul className="space-y-2.5">
                {links.map(({ label, href, disabled }) => (
                  <li key={label}>
                    <a
                      href={href}
                      className={
                        disabled
                          ? 'pointer-events-none cursor-default text-sm text-slate-700'
                          : 'text-sm text-slate-500 transition-colors duration-150 hover:text-slate-200'
                      }
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="divider" />
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6">
        <p className="text-xs text-slate-600">
          &copy; {new Date().getFullYear()} ParchiVisa. All rights reserved.
        </p>
        <p className="text-center text-xs text-slate-700 sm:text-right">
          Not affiliated with any government visa authority. For informational purposes only.
        </p>
      </div>
    </footer>
  )
}

function FooterPrimaryCta() {
  if (!CLERK_ENABLED) {
    return (
      <Link href="/tools/student-visa/countries" className="btn-primary hover-glow">
        Check My Readiness
      </Link>
    )
  }

  return (
    <>
      <SignedOut>
        <SignUpButton mode="modal">
          <button className="btn-primary hover-glow">Create free account</button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <Link href="/tools/student-visa/countries" className="btn-primary hover-glow">
          Check My Readiness
        </Link>
      </SignedIn>
    </>
  )
}
