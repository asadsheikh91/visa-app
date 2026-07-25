import Link from 'next/link'
import type { ReactNode } from 'react'
import { BrandSeal } from '@/components/BrandSeal'

/**
 * Paper document frame around the Clerk sign-in / sign-up widget.
 * The widget itself is themed by the light Clerk appearance set in
 * app/layout.tsx; this supplies the surrounding "official document" chrome.
 */
export function AuthShell({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-gutter pb-16 pt-28">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link href="/" className="flex flex-col items-center gap-3" aria-label="ParchiVisa home">
            <BrandSeal className="h-16 w-16" />
            <span className="font-serif text-[22px] leading-none tracking-tight text-ink">
              Parchi<em className="italic">Visa</em>
            </span>
          </Link>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-support">{eyebrow}</p>
        </div>
        <div className="flex justify-center">{children}</div>
      </div>
    </div>
  )
}
