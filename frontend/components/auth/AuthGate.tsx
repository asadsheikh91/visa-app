'use client'

import { useAuth, SignInButton, SignUpButton } from '@clerk/nextjs'
import { Loader2, Lock } from 'lucide-react'
import type { ReactNode } from 'react'

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

function SignInWall() {
  return (
    <div className="mx-auto max-w-md rounded-[4px] border border-hairline bg-white p-8 text-center shadow-[6px_6px_0_0] shadow-ink/10">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[4px] border border-hairline bg-paper">
        <Lock size={20} className="text-stamp" />
      </div>
      <h2 className="mb-2 font-serif text-[22px] leading-tight text-ink">Sign in to continue</h2>
      <p className="mb-6 font-body text-sm text-support">
        Create a free account or sign in to run the Student Visa Readiness Checker.
        Your check stays tied to your secure session.
      </p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <SignInButton mode="modal">
          <button className="btn-secondary text-sm">Sign in</button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="btn-primary text-sm">Create account — it&apos;s free</button>
        </SignUpButton>
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <Loader2 size={32} className="animate-spin text-stamp" />
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-support">Checking your session…</p>
    </div>
  )
}

function ClerkGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) return <Loading />
  if (!isSignedIn) return <SignInWall />
  return <>{children}</>
}

/**
 * Wraps content that requires an authenticated user. When Clerk is configured,
 * unauthenticated visitors get a sign-in wall (server-side middleware also
 * protects these routes). When Clerk is not configured, we show a clear notice
 * instead of silently exposing the tool.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  if (!CLERK_ENABLED) {
    return (
      <div className="mx-auto max-w-md rounded-[4px] border border-seal-text/40 bg-white p-8 text-center shadow-[6px_6px_0_0] shadow-ink/10">
        <Lock size={22} className="mx-auto mb-3 text-seal-text" />
        <h2 className="mb-2 font-serif text-[19px] leading-tight text-ink">Authentication not configured</h2>
        <p className="font-body text-sm text-support">
          This tool requires sign-in. Set <code className="font-mono text-seal-text">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> to enable it.
        </p>
      </div>
    )
  }
  return <ClerkGate>{children}</ClerkGate>
}
