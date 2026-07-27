import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from './_og/og-card'

// Edge, because the font files are loaded with the
// `fetch(new URL('./x.ttf', import.meta.url))` convention. Under the node
// runtime webpack rewrites that to a bare "/_next/static/media/..." path and
// undici's fetch rejects it as an invalid URL (ERR_INVALID_URL); the edge
// runtime resolves it. Route segment config has to be a literal export in the
// route file, so this is repeated in each opengraph-image.tsx.
export const runtime = 'edge'

export const alt =
  'ParchiVisa — Find out what’s wrong with your file now, not in the refusal letter.'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image() {
  return ogCard({
    eyebrow: 'Student visa readiness · UK · AUS · CAN · USA',
    headline: 'Find out what’s wrong with your file now, not in the refusal letter.',
  })
}
