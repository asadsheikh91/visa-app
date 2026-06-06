'use client'

import { useAuth, SignInButton, SignUpButton } from '@clerk/nextjs'
import { Loader2, Lock } from 'lucide-react'
import type { ReactNode } from 'react'

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

function SignInWall() {
  return (
    <div className="glass rounded-2xl p-8 text-center border border-white/10 max-w-md mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-accent-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-900/40">
        <Lock size={20} className="text-white" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Sign in to continue</h2>
      <p className="text-slate-400 text-sm mb-6">
        Create a free account or sign in to run the Student Visa Readiness Checker.
        Your check stays tied to your secure session.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <SignInButton mode="modal">
          <button className="btn-secondary justify-center text-sm">Sign in</button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="btn-primary justify-center text-sm">Create account — it&apos;s free</button>
        </SignUpButton>
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 size={32} className="text-brand-400 animate-spin" />
      <p className="text-slate-500 text-sm">Checking your session…</p>
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
      <div className="glass rounded-2xl p-8 text-center border border-amber-700/30 bg-amber-900/10 max-w-md mx-auto">
        <Lock size={22} className="text-amber-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white mb-2">Authentication not configured</h2>
        <p className="text-slate-400 text-sm">
          This tool requires sign-in. Set <code className="text-amber-300">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> to enable it.
        </p>
      </div>
    )
  }
  return <ClerkGate>{children}</ClerkGate>
}
