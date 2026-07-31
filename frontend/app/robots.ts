import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

/**
 * Generated at /robots.txt.
 *
 * Everything disallowed here is either behind Clerk (so a crawler only ever
 * receives a redirect to sign-in) or addressed by an unguessable token. Leaving
 * them crawlable does not leak anything, but it does spend crawl budget on
 * redirects and can surface sign-in pages in results instead of real content.
 *
 * /report is disallowed for a stronger reason: report URLs carry a token that is
 * the only thing standing between a stranger and someone's assessment. They must
 * never end up in an index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/dashboard',
        '/onboarding',
        '/report',
        '/sign-in',
        '/sign-up',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
