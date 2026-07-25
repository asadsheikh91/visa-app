'use client'

import { useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import type { ChecklistItem, ChecklistStatus } from '@/types/visa'
import {
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_CLASSES,
  STATUS_DOT,
  PRIORITY_LABELS,
  PRIORITY_CLASSES,
} from '@/lib/dashboardDisplay'

interface Props {
  item: ChecklistItem
  onStatusChange: (itemId: string, status: ChecklistStatus) => void
  /** True while this item's status update is in flight. */
  saving?: boolean
}

export function ChecklistItemRow({ item, onStatusChange, saving }: Props) {
  const [showGuidance, setShowGuidance] = useState(false)

  return (
    <div className="rounded-[3px] border border-hairline bg-white p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        {/* Title + priority + reason */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-body text-sm font-semibold leading-snug text-ink">{item.title}</h4>
            <span
              className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] ${PRIORITY_CLASSES[item.priority]}`}
            >
              {PRIORITY_LABELS[item.priority]}
            </span>
          </div>
          {item.reason && (
            <p className="mt-1 font-body text-xs leading-snug text-support">{item.reason}</p>
          )}

          {item.guidance && (
            <>
              <button
                type="button"
                onClick={() => setShowGuidance(v => !v)}
                aria-expanded={showGuidance}
                className="mt-1.5 inline-flex items-center gap-1 font-body text-[11px] text-stamp transition-colors hover:text-stamp-deep"
              >
                <Info size={11} />
                {showGuidance ? 'Hide guidance' : 'How to prepare this'}
              </button>
              {showGuidance && (
                <p className="mt-2 rounded-[3px] border border-hairline bg-paper-deep p-2.5 font-body text-xs leading-relaxed text-ink">
                  {item.guidance}
                </p>
              )}
            </>
          )}
        </div>

        {/* Status select */}
        <div className="flex-shrink-0">
          <div className={`relative rounded-[3px] border ${STATUS_CLASSES[item.status]} ${saving ? 'opacity-60' : ''}`}>
            <span
              className={`pointer-events-none absolute left-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${STATUS_DOT[item.status]}`}
            />
            <select
              value={item.status}
              disabled={saving}
              onChange={e => onStatusChange(item.id, e.target.value as ChecklistStatus)}
              aria-label={`Status for ${item.title}`}
              className="cursor-pointer appearance-none bg-transparent py-1.5 pl-6 pr-7 font-mono text-xs font-medium text-current focus:outline-none"
            >
              {STATUS_ORDER.map(s => (
                <option key={s} value={s} className="bg-white text-ink">
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-70"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
