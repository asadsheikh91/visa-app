import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { pvSerif, pvSans, pvMono } from './pv-fonts'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'ParchiVisa',
  description: 'ParchiVisa checks your documents and gives you a readiness score before you apply for a visa.',
  keywords: ['visa readiness', 'student visa', 'visa checker', 'UK visa', 'USA visa', 'Canada visa'],
  openGraph: {
    title: 'ParchiVisa — Know Your Visa Readiness Before You Apply',
    description: 'Check your visa documents and get a readiness score before you apply.',
    type: 'website',
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
        <Navbar />
        <main>{children}</main>
        <Footer />
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
