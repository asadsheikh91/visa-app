import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { NextFetchEvent } from 'next/server'

/**
 * ParchiVisa middleware
 *
 * When NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set, clerkMiddleware runs and the
 * Student Visa Checker routes are protected — unauthenticated visitors are
 * redirected to sign-in. When no key is set, a plain pass-through is used so the
 * app still loads (the AuthGate component then shows a "not configured" notice).
 */

// The checker and the dashboard require an authenticated session.
// (Old /student-visa paths only redirect, so they don't need protection.)
const isProtectedRoute = createRouteMatcher([
  '/tools/student-visa(.*)',
  '/dashboard(.*)',
])

// In @clerk/nextjs v5, `auth` is a function — call it, then .protect().
const _clerkHandler = clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect()
  }
})

export default function middleware(req: NextRequest, evt: NextFetchEvent) {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return _clerkHandler(req, evt)
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
