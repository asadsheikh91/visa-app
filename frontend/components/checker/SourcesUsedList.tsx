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
    ? 'text-xs font-semibold text-slate-400'
    : 'text-sm font-bold text-slate-300'
  const itemCls = compact ? 'text-xs' : 'text-sm'
  const wrapperCls = compact
    ? 'rounded-xl border border-white/10 bg-white/5 px-4 py-3'
    : 'rounded-2xl border border-slate-500/20 bg-slate-500/5 p-5'

  return (
    <div className={wrapperCls}>
      <div className="flex items-center gap-2 mb-2">
        <BookOpen size={iconSize} className="text-slate-400" aria-hidden="true" />
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
                  className="inline-flex items-center gap-1 text-brand-400 hover:text-brand-300 underline underline-offset-2 transition-colors break-all"
                >
                  {displayName}
                  <ExternalLink size={extIconSize} aria-hidden="true" />
                </a>
              )}
              {hasIds && (
                <span className={`text-slate-400${source.source_url ? ' ml-2' : ''}`}>
                  {source.source_url
                    ? `(ID: ${source.source_ids!.join(', ')})`
                    : `Source IDs: ${source.source_ids!.join(', ')}`}
                </span>
              )}
              {!source.source_url && !hasIds && (
                <span className="text-slate-500">Unknown source</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
