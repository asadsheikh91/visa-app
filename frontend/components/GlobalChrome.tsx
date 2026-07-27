'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Routes that render their own paper-themed <LandingNav>/<LandingFooter> and
 * must therefore NOT also get the global <Navbar>/<Footer> from the root layout.
 *
 * These are the same routes that set `data-pv-landing` on their wrapper (see
 * app/page.tsx, app/why-visas-fail/page.tsx). Keep the two in step.
 */
export const LANDING_ROUTES = ['/', '/why-visas-fail']

/**
 * Suppresses the global chrome on landing routes.
 *
 * This used to be done in CSS — `body:has([data-pv-landing]) > header/footer
 * { display: none }` in globals.css. That hid the global nav and footer
 * visually but still emitted both of them into the HTML, so the page shipped
 * two <header> landmarks and two <footer> landmarks with two different link
 * sets. Screen readers, crawlers and "view source" all saw the duplicate.
 * Not rendering them at all is the actual fix; the CSS rule is kept only as a
 * belt-and-braces backstop.
 *
 * usePathname is available during the App Router's server render, so the
 * suppressed chrome is absent from the SSR HTML too — not removed after
 * hydration.
 */
export function GlobalChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname && LANDING_ROUTES.includes(pathname)) return null
  return <>{children}</>
}
