import { Newsreader, Public_Sans, JetBrains_Mono } from 'next/font/google'

/**
 * "The Official Document" landing type stack — self-hosted via next/font
 * (fonts are downloaded at build time and served from our own origin).
 *
 * - Newsreader: display serif. Variable weight + optical size; at large opsz
 *   it develops the high-contrast, engraved feel that carries the
 *   institutional voice. True italics for editorial clauses.
 * - Public Sans: body/UI. The USWDS government typeface — neutral,
 *   institutional, on-concept for an "official document."
 * - JetBrains Mono: data, scores, form-number labels. Tabular figures.
 */
export const pvSerif = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-pv-serif',
  display: 'swap',
  // Next 14 has no fallback-metric table for Newsreader and logs
  // "Failed to find font override values" on every compile; the automatic
  // adjustment is already a no-op, so disable it explicitly.
  adjustFontFallback: false,
})

export const pvSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-pv-sans',
  display: 'swap',
})

export const pvMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-pv-mono',
  display: 'swap',
})
