import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * ParchiVisa middleware
 *
 * When NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set, clerkMiddleware runs and the
 * Student Visa Checker + dashboard routes are protected — unauthenticated
 * visitors are redirected to sign-in. When no key is set, a plain pass-through
 * is used so the app still loads (AuthGate then shows a "not configured" notice).
 *
 * IMPORTANT: the clerkMiddleware() handler must be the *direct* default export.
 * Wrapping it in another per-request function prevents Clerk from attaching the
 * request context that auth()/<ClerkProvider> read during SSR, which surfaces as
 * "auth() was called but Clerk can't detect usage of clerkMiddleware()". So the
 * enabled/disabled decision is made once here, at module load.
 */

// The checker, onboarding, and dashboard all require an authenticated session.
const isProtectedRoute = createRouteMatcher([
  '/tools/student-visa(.*)',
  '/tools/sop-review(.*)',
  '/tools/mock-interview(.*)',
  '/tools/document-guide(.*)',
  '/tools/financial-document(.*)',
  '/dashboard(.*)',
  '/onboarding(.*)',
  '/timeline(.*)',
  '/trust(.*)',
  // '/consultant(.*)' — the agency route is withdrawn and 404s (see
  // app/consultant/page.tsx). Leaving it protected would bounce visitors to
  // sign-in instead of showing the 404. Restore alongside the route.
  '/report(.*)',
  '/admin(.*)',
])

// Next's metadata file conventions (app/**/opengraph-image.tsx etc.) compile to
// GET routes UNDER the page they belong to, so a protected page's share image
// would 307 to sign-in and every unfurl would fall back to a grey box. They
// render static brand art with no user data, so they are public everywhere.
// In production the emitted path carries a build hash: /…/opengraph-image-<hash>.
const isMetadataImageRoute = createRouteMatcher([
  '/(.*)(opengraph-image|twitter-image)(-.*)?',
  '/(opengraph-image|twitter-image)(-.*)?',
])

// The checker's country picker is the URL that actually gets shared, so it has
// to be crawlable — a 307 to /sign-in means the share card is built from the
// sign-in page, not this one. Only the page shell is public: <AuthGate> still
// walls the CountrySelector itself, and every route BELOW this one
// (/countries/[country], the questionnaire, results) stays protected above.
const isPublicCheckerShell = createRouteMatcher([
  '/tools/student-visa',
  '/tools/student-visa/countries',
])

// Report routes that must NOT require a Clerk session:
//   - /report/*/print : loaded by the server-side Playwright renderer (no session);
//     carries a single-use render token and shows nothing without valid data.
//   - /report/preview  : a dev-only design preview rendered from mock data; the
//     page itself 404s in production, so it is inert there.
const isPublicReportRoute = createRouteMatcher(['/report/(.*)/print', '/report/preview'])

// In @clerk/nextjs v5, `auth` is a function — call it to read the session.
// For signed-out visitors we redirect to the sign-in page instead of calling
// `auth().protect()`, whose default for non-document requests is a bare 404.
// `redirectToSignIn` preserves the original URL via `redirect_url` so the user
// lands back where they intended after authenticating.
const middleware = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? clerkMiddleware((auth, req) => {
      const isPublic =
        isPublicReportRoute(req) || isMetadataImageRoute(req) || isPublicCheckerShell(req)
      if (isProtectedRoute(req) && !isPublic) {
        const { userId, redirectToSignIn } = auth()
        if (!userId) {
          return redirectToSignIn({ returnBackUrl: req.url })
        }
      }
    })
  : () => NextResponse.next()

export default middleware

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
