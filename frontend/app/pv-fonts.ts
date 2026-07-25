import { Libre_Caslon_Display, Public_Sans, IBM_Plex_Mono } from 'next/font/google'

/**
 * "The Official Document" landing type stack — self-hosted via next/font
 * (fonts are downloaded at build time and served from our own origin).
 *
 * The stack does the conceptual work: Caslon is the historic face of British
 * government printing; Public Sans is the US federal (USWDS) typeface; Plex
 * Mono carries the form-field feel.
 *
 * - Libre Caslon Display: H1 and section headings only. Google Fonts publishes
 *   this face in a SINGLE weight (400) — there is no 700 cut — so headings use
 *   its natural display weight and must NOT rely on font-weight utilities to
 *   get bolder. At large sizes it develops the high-contrast, engraved feel.
 *   No italic file exists either; any `italic` usage renders as faux-oblique.
 * - Public Sans: body/UI. 400/600 via the variable axis.
 * - IBM Plex Mono: data, scores, form-number labels. 400/500, tabular figures.
 *
 * Weights are held to the minimum the design uses and subset to latin +
 * latin-ext to keep the webfont payload small for Pakistani mobile data.
 */
export const pvSerif = Libre_Caslon_Display({
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  variable: '--font-pv-serif',
  display: 'swap',
  // Let next/font generate size-adjusted fallback metrics if it has a table
  // for this face (verified via build logs). If it can't, the hand-tuned
  // 'PV Serif Fallback' @font-face in pv-tokens.css is the backstop.
})

export const pvSans = Public_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-pv-sans',
  display: 'swap',
})

export const pvMono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin', 'latin-ext'],
  variable: '--font-pv-mono',
  display: 'swap',
})
