import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { pvSerif, pvSans, pvMono } from './pv-fonts'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { GlobalChrome } from '@/components/GlobalChrome'
import { Analytics } from '@/components/Analytics'

// metadataBase is mandatory, not cosmetic: without it Next emits RELATIVE
// og:image paths, which every crawler rejects silently — the single most common
// reason an added og:image still unfurls as a grey box. It also makes the
// file-convention opengraph-image.tsx routes resolve to absolute https URLs.
export const metadata: Metadata = {
  metadataBase: new URL('https://parchivisa.app'),
  title: 'ParchiVisa — Know your visa readiness before you apply',
  description:
    'Check your file against the official UKVI, IRCC and Home Affairs rules. ' +
    'Free readiness score and gap list for the UK, Australia, Canada and the USA.',
  keywords: [
    'Pakistani student visa',
    'student visa readiness',
    'visa checker',
    'UK student visa',
    'Australia student visa',
    'Canada student visa',
    'USA student visa',
  ],
  // No title/description here on purpose — omitting them lets Next inherit the
  // fields above (and each route's own title), so the card copy never drifts
  // from the page copy.
  openGraph: {
    type: 'website',
    siteName: 'ParchiVisa',
    url: 'https://parchivisa.app',
    locale: 'en_GB',
  },
  // summary_large_image, not summary: renders the 1200x630 card full-width
  // instead of shrinking it to a small square thumbnail.
  twitter: {
    card: 'summary_large_image',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

// "Official Document" light appearance — paper ground, ink text, stamp-green
// primary. Matches the landing/app paper theme (see app/pv-tokens.css).
const clerkAppearance = {
  variables: {
    colorBackground: '#F5EBD6',
    colorInputBackground: '#ffffff',
    colorInputText: '#14213D',
    colorText: '#14213D',
    colorTextSecondary: '#6B6560',
    colorNeutral: '#14213D',
    colorPrimary: '#1F6B4A',
    colorDanger: '#A83F07',
    borderRadius: '3px',
  },
  elements: {
    card: { boxShadow: 'none', border: '1px solid #E8DFC8' },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  const body = (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${pvSerif.variable} ${pvSans.variable} ${pvMono.variable} font-body`}
    >
      <body>
        {/* Landing routes ship their own nav/footer — GlobalChrome keeps this
            pair out of the markup there entirely, rather than hiding it. */}
        <GlobalChrome>
          <Navbar />
        </GlobalChrome>
        <main>{children}</main>
        <GlobalChrome>
          <Footer />
        </GlobalChrome>
        <Analytics />
      </body>
    </html>
  )

  if (!publishableKey) return body

  return (
    <ClerkProvider publishableKey={publishableKey} appearance={clerkAppearance}>
      {body}
    </ClerkProvider>
  )
}
