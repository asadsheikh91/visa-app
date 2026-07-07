'use client'

import { useEffect } from 'react'

/**
 * Sets `data-report-print` on <body> while mounted, which globals.css uses to hide
 * the app's Navbar/Footer so the print route renders bare (for the Playwright PDF).
 * Renders nothing.
 */
export function HideAppChrome() {
  useEffect(() => {
    document.body.setAttribute('data-report-print', '1')
    return () => document.body.removeAttribute('data-report-print')
  }, [])
  return null
}
