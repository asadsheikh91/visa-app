import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'ParchiVisa — Know Your Visa Readiness Before You Apply',
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

const clerkAppearance = {
  variables: {
    colorBackground: '#0a0908',
    colorInputBackground: '#161311',
    colorInputText: '#f1f5f9',
    colorText: '#f1f5f9',
    colorTextSecondary: '#cbd5e1',
    // Lightens the menu action labels/icons, which derive from the neutral color.
    colorNeutral: '#ffffff',
    colorPrimary: '#ff5a1f',
    colorDanger: '#ef4444',
    borderRadius: '0.75rem',
  },
  elements: {
    userButtonPopoverActionButton: { color: '#e2e8f0' },
    userButtonPopoverActionButtonIcon: { color: '#e2e8f0' },
    userButtonPopoverActionButton__signOut: { color: '#e2e8f0' },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  const body = (
    <html lang="en" suppressHydrationWarning className="font-sans">
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
