import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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

const clerkAppearance = {
  variables: {
    colorBackground: '#0a0620',
    colorInputBackground: '#160d3d',
    colorInputText: '#f1f5f9',
    colorText: '#f1f5f9',
    colorTextSecondary: '#94a3b8',
    colorPrimary: '#673BFF',
    colorDanger: '#ef4444',
    borderRadius: '0.75rem',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  const body = (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
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
