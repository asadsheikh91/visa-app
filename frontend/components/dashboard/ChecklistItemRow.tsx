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
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        {/* Title + priority + reason */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-white leading-snug">{item.title}</h4>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wide ${PRIORITY_CLASSES[item.priority]}`}
            >
              {PRIORITY_LABELS[item.priority]}
            </span>
          </div>
          {item.reason && (
            <p className="text-xs text-slate-400 mt-1 leading-snug">{item.reason}</p>
          )}

          {item.guidance && (
            <>
              <button
                type="button"
                onClick={() => setShowGuidance(v => !v)}
                aria-expanded={showGuidance}
                className="inline-flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 mt-1.5 transition-colors"
              >
                <Info size={11} />
                {showGuidance ? 'Hide guidance' : 'How to prepare this'}
              </button>
              {showGuidance && (
                <p className="text-xs text-slate-300 mt-2 leading-relaxed rounded-lg bg-white/5 border border-white/10 p-2.5">
                  {item.guidance}
                </p>
              )}
            </>
          )}
        </div>

        {/* Status select */}
        <div className="flex-shrink-0">
          <div className={`relative rounded-lg border ${STATUS_CLASSES[item.status]} ${saving ? 'opacity-60' : ''}`}>
            <span
              className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${STATUS_DOT[item.status]} pointer-events-none`}
            />
            <select
              value={item.status}
              disabled={saving}
              onChange={e => onStatusChange(item.id, e.target.value as ChecklistStatus)}
              aria-label={`Status for ${item.title}`}
              className="appearance-none bg-transparent pl-6 pr-7 py-1.5 text-xs font-medium focus:outline-none cursor-pointer text-current"
            >
              {STATUS_ORDER.map(s => (
                <option key={s} value={s} className="bg-surface-900 text-white">
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
