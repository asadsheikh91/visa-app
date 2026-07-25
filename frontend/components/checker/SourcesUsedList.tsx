import { ExternalLink, BookOpen } from 'lucide-react'
import type { SourceRef } from '@/types/visa'

interface Props {
  sources: SourceRef[]
  /** Compact mode: smaller sizes and tighter border for history cards. */
  compact?: boolean
}

/**
 * Deduplicated, null-safe list of official sources.
 *
 * Rules:
 *  - source_url → clickable external link (target="_blank" rel="noopener noreferrer")
 *  - name / title → used as link text when present; fallback: "Official source N"
 *  - source_ids → plain text "Source IDs: …" (or inline "(ID: …)" when URL also present)
 *  - Entries with neither url nor ids are silently skipped
 *  - Duplicate URLs (or identical id-sets) are shown only once
 *  - Never renders [object Object]
 *
 * Returns null when the effective list is empty (safe to render unconditionally).
 */
export function SourcesUsedList({ sources, compact = false }: Props) {
  // 1. Filter to entries that have at least one useful field
  const valid = (sources ?? []).filter(
    (s) => s.source_url || (s.source_ids && s.source_ids.length > 0)
  )

  // 2. Deduplicate: key = source_url if present, else sorted ids joined
  const seen = new Set<string>()
  const unique = valid.filter((s) => {
    const key =
      s.source_url ?? s.source_ids?.slice().sort().join(',') ?? ''
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (unique.length === 0) return null

  const iconSize    = compact ? 12 : 16
  const extIconSize = compact ? 10 : 12
  const headingCls  = compact
    ? 'font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink'
    : 'font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink'
  const itemCls = compact ? 'font-body text-xs' : 'font-body text-sm'
  const wrapperCls = compact
    ? 'rounded-[3px] border border-hairline bg-paper-deep px-4 py-3'
    : 'rounded-[4px] border border-hairline bg-white p-5'

  return (
    <div className={wrapperCls}>
      <div className="mb-2 flex items-center gap-2">
        <BookOpen size={iconSize} className="text-support" aria-hidden="true" />
        <h5 className={headingCls}>Official Sources ({unique.length})</h5>
      </div>
      <ul className="space-y-1.5">
        {unique.map((source, i) => {
          // Resolve a human-readable display name; never fall through to objects
          const displayName =
            (typeof source.name === 'string' && source.name) ||
            (typeof source.title === 'string' && source.title) ||
            source.source_url ||
            `Official source ${i + 1}`

          const hasIds = source.source_ids && source.source_ids.length > 0

          return (
            <li key={i} className={itemCls}>
              {source.source_url && (
                <a
                  href={source.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 break-all text-stamp underline decoration-hairline underline-offset-2 transition-colors hover:decoration-stamp"
                >
                  {displayName}
                  <ExternalLink size={extIconSize} aria-hidden="true" />
                </a>
              )}
              {hasIds && (
                <span className={`text-support${source.source_url ? ' ml-2' : ''}`}>
                  {source.source_url
                    ? `(ID: ${source.source_ids!.join(', ')})`
                    : `Source IDs: ${source.source_ids!.join(', ')}`}
                </span>
              )}
              {!source.source_url && !hasIds && (
                <span className="text-support">Unknown source</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
