import type { ReactNode } from 'react'

/**
 * Loads the report's display fonts (Source Serif 4 + JetBrains Mono; Inter is
 * already loaded globally) for both the on-screen and print report routes.
 */
export default function ReportLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  )
}
