'use client'

import { ExternalLink } from 'lucide-react'

interface Props {
  /** Display label, e.g. "UKVI — Student visa money". Falls back to "Official guidance". */
  label?: string
  /** Link to the official guidance. When omitted the label renders as plain text. */
  url?: string
  /** ISO date (YYYY-MM-DD) of when the guidance was last reviewed. */
  lastReviewed?: string
  className?: string
}

function formatReviewed(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

/**
 * Trust/Sources layer (Module D): a consistent, dated citation to an official
 * authority. Used wherever a rule, checklist item, or action step is shown so
 * every claim on the site is traceable to a government source.
 */
export function SourceCitation({ label, url, lastReviewed, className = '' }: Props) {
  const text = label ?? 'Official guidance'
  const reviewed = formatReviewed(lastReviewed)
  const base = 'inline-flex items-center gap-1 font-mono text-[10px] text-support'

  return (
    <span className={`${base} ${className}`}>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-stamp hover:text-stamp-deep"
        >
          {text} <ExternalLink size={10} />
        </a>
      ) : (
        <span>{text}</span>
      )}
      {reviewed && <span className="text-support">· reviewed {reviewed}</span>}
    </span>
  )
}
