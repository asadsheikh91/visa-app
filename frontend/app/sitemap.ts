import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

/**
 * Generated at /sitemap.xml, and submitted to Google Search Console.
 *
 * Only publicly reachable pages belong here. Every Clerk-protected route answers
 * a signed-out crawler with a 307 to sign-in, so listing one would advertise a
 * URL that cannot be indexed — Search Console reports those back as errors and
 * they dilute the crawl.
 *
 * Deliberately excluded, all verified as redirecting when signed out:
 *   /dashboard, /onboarding, /admin, /trust, /timeline,
 *   /tools/document-guide, /tools/financial-document,
 *   /tools/sop-review, /tools/mock-interview (also feature-flagged off),
 *   /tools/student-visa/countries/[country] — the checker itself is gated
 *
 * Keep this list in step with middleware.ts: a route that becomes public should
 * be added, and one that becomes protected must be removed.
 */

type Entry = { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }

const PAGES: Entry[] = [
  { path: '/',                              priority: 1.0, changeFrequency: 'weekly'  },
  { path: '/why-visas-fail',                priority: 0.9, changeFrequency: 'monthly' },
  { path: '/why-rejected',                  priority: 0.9, changeFrequency: 'monthly' },
  { path: '/how-it-works',                  priority: 0.8, changeFrequency: 'monthly' },
  { path: '/tools/student-visa/countries',  priority: 0.8, changeFrequency: 'monthly' },
  { path: '/checklist',                     priority: 0.7, changeFrequency: 'monthly' },
  { path: '/compare',                       priority: 0.7, changeFrequency: 'monthly' },
  { path: '/tools',                         priority: 0.6, changeFrequency: 'monthly' },
  { path: '/tools/student-visa',            priority: 0.6, changeFrequency: 'monthly' },
  { path: '/about',                         priority: 0.5, changeFrequency: 'yearly'  },
  { path: '/reviews',                       priority: 0.5, changeFrequency: 'monthly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return PAGES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
