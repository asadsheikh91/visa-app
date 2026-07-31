import { SITE_NAME, SITE_PROFILES, SITE_URL } from '@/lib/site'

/**
 * schema.org Organization + WebSite, emitted as JSON-LD in the document head.
 *
 * Why this exists rather than being left to Google's own inference: searching
 * "parchivisa" currently returns Parchisi STAR, Parchis rules and the board
 * game's dictionary entry, because the brand name is one character away from a
 * century-old game with enormous search volume. Google is treating the brand as
 * a misspelling.
 *
 * Structured data is the explicit way to say otherwise: this is an Organization,
 * its name is spelled exactly this way, it lives at this URL, and these social
 * profiles are the same entity. It does not force a ranking — nothing does — but
 * it removes the ambiguity that the ranking is currently resolving the wrong way.
 *
 * `alternateName` is included because the Instagram handle reads "parchi.visa"
 * while the product is "ParchiVisa"; declaring both stops the two from looking
 * like unrelated brands.
 */
export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: ['Parchi Visa', 'parchi.visa'],
        url: SITE_URL,
        logo: `${SITE_URL}/icon.svg`,
        description:
          'Student visa readiness checks for applicants to the UK, Canada, Australia ' +
          'and the USA. Assesses a file against published government criteria before ' +
          'it is submitted.',
        ...(SITE_PROFILES.length > 0 && { sameAs: SITE_PROFILES }),
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en',
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      // Server-rendered from a literal defined above -- no user input reaches this.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
