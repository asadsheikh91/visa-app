'use client'

import { usePathname } from 'next/navigation'
import { GoogleAnalytics } from '@next/third-parties/google'

/**
 * Google Analytics 4, minus the pageviews that aren't people.
 *
 * Two filters, both of which matter more at launch volumes than they would later:
 *
 * 1. The report PDF pipeline renders /report/<token>/print in a headless Chromium
 *    on our own server. That render executes page scripts, so an unfiltered tag
 *    counts every generated PDF as a visit from our own infrastructure. With a
 *    handful of real visitors a day, that is enough to make the number wrong.
 *
 * 2. Nothing renders unless NEXT_PUBLIC_GA_ID is set, so local development and
 *    Vercel preview deployments never write into the production property.
 *
 * NEXT_PUBLIC_* values are inlined at build time, so changing the ID requires a
 * redeploy rather than a restart.
 */
export function Analytics() {
  const pathname = usePathname()
  const gaId = process.env.NEXT_PUBLIC_GA_ID

  if (!gaId) return null
  if (pathname?.startsWith('/report/') && pathname.endsWith('/print')) return null

  return <GoogleAnalytics gaId={gaId} />
}
