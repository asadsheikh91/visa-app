import type { ReactNode } from 'react'

/**
 * The report inherits the app's self-hosted type stack (Libre Caslon Display /
 * Public Sans / IBM Plex Mono) — next/font sets --font-pv-serif|sans|mono on
 * <html> in the root layout, and report.module.css consumes those variables.
 *
 * There is deliberately no external font <link> here any more. The previous
 * Source Serif 4 + JetBrains Mono stylesheet came from fonts.googleapis.com,
 * which (a) put the report on a different type system to the rest of the site
 * and (b) made the Playwright PDF render depend on a third-party request
 * resolving before paint. Both are now gone.
 */
export default function ReportLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
