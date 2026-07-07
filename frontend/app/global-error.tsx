'use client'

import { useEffect } from 'react'

/**
 * Last-resort boundary for errors thrown in the root layout itself. Unlike
 * app/error.tsx, this replaces the entire document, so it must render its own
 * <html>/<body>. Kept dependency-free (no shared CSS classes guaranteed) so it
 * renders even if the layout failed before styles loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0908',
          color: '#f1f5f9',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '1.5rem',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0 0 1.75rem' }}>
            ParchiVisa hit an unexpected error. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#ff5a1f',
              color: '#fff',
              border: 'none',
              borderRadius: 9999,
              padding: '0.75rem 1.5rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
