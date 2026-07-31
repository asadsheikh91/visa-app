/**
 * Canonical site identity, in one place.
 *
 * The origin was previously written out by hand in app/layout.tsx (metadataBase,
 * openGraph.url). robots.ts, sitemap.ts and the Organization structured data all
 * need it too, and a sitemap that disagrees with metadataBase by so much as a
 * trailing slash is a self-inflicted SEO bug — so they all read it from here.
 */
export const SITE_URL = 'https://parchivisa.app'

export const SITE_NAME = 'ParchiVisa'

/**
 * Profiles that represent this same organisation.
 *
 * These feed schema.org `sameAs`, which is how Google is told that a brand and
 * its social accounts are one entity rather than unrelated pages that happen to
 * share a word. That matters more than usual here: "parchivisa" is close enough
 * to "Parchisi", the board game, that search currently treats the brand as a
 * misspelling of it.
 *
 * Only add a URL that resolves. A sameAs pointing at a 404 is worse than an
 * absent one.
 */
export const SITE_PROFILES: string[] = [
  'https://www.instagram.com/parchi.visa/',
]
