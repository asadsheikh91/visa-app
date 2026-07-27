import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '../../../_og/og-card'

// See app/opengraph-image.tsx for why this must be edge.
export const runtime = 'edge'

export const alt =
  'ParchiVisa — Check your file against the official rules for the UK, Australia, Canada and the USA.'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image() {
  return ogCard({
    eyebrow: 'Readiness checker · Free · 2 minutes',
    headline: 'Check your file against the official rules before an officer does.',
  })
}
