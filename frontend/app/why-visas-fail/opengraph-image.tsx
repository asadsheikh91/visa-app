import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '../_og/og-card'

// See app/opengraph-image.tsx for why this must be edge.
export const runtime = 'edge'

export const alt =
  'ParchiVisa — Why the refusal rate moved, and what it means for your file.'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default async function Image() {
  return ogCard({
    eyebrow: 'What changed · Pakistani student visas',
    headline: 'Why the refusal rate moved, and what it means for your file.',
  })
}
