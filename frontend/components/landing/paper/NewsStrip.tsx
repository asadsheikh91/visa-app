'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, X } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { NEWS_STRIP } from '@/content/news-strip'

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function writeCookie(name: string, value: string, days: number) {
  const maxAge = days * 24 * 60 * 60
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`
}

/**
 * Full-bleed strip above the nav. Dismissal persists in a cookie (not
 * localStorage — see brief) for 30 days. Defaults to visible on first render
 * (server and client agree) so there's no hydration mismatch; the effect
 * below hides it a frame later if the cookie says it was already dismissed.
 */
export function NewsStrip() {
  const reduced = useReducedMotion() ?? false
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (readCookie(NEWS_STRIP.cookieName)) setVisible(false)
  }, [])

  const dismiss = () => {
    writeCookie(NEWS_STRIP.cookieName, '1', NEWS_STRIP.cookieDays)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <motion.div
      role="region"
      aria-label="Latest visa news"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: '-100%' }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced ? { duration: 0.2 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
      }
      className="w-full border-b border-hairline bg-paper-deep"
    >
      <div className="mx-auto flex h-9 max-w-content items-center gap-3 px-gutter sm:h-10">
        <LiveDot reduced={reduced} />

        <p className="min-w-0 flex-1 truncate font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-support sm:text-[10.5px]">
          <span className="hidden sm:inline">{NEWS_STRIP.text}</span>
          <span className="sm:hidden">{NEWS_STRIP.mobileText}</span>
        </p>

        <Link
          href={NEWS_STRIP.linkHref}
          className="group flex flex-shrink-0 items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink sm:text-[10.5px]"
        >
          {NEWS_STRIP.linkLabel}
          <ArrowRight
            size={12}
            aria-hidden="true"
            className="transition-transform duration-[180ms] group-hover:translate-x-[3px]"
          />
        </Link>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 flex-shrink-0 p-1 text-support transition-colors hover:text-ink"
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  )
}

function LiveDot({ reduced }: { reduced: boolean }) {
  // -ml pulls the dot back by its own width + the row's gap-3 (6px + 12px =
  // 18px) so it reads as a marker sitting before the text rather than
  // pushing the text 18px right of the nav logo / eyebrow's shared gutter.
  return (
    <span className="relative -ml-[18px] flex h-1.5 w-1.5 flex-shrink-0" aria-hidden="true">
      {!reduced && (
        <motion.span
          className="absolute inset-0 rounded-full bg-stamp"
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 2.4 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <span className="relative h-1.5 w-1.5 rounded-full bg-stamp" />
    </span>
  )
}
