'use client'

import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'

export interface DashboardNavItem {
  id:    string
  label: string
  icon:  LucideIcon
  badge?: string | number
}

interface Props {
  items:    DashboardNavItem[]
  active:   string
  onSelect: (id: string) => void
}

/**
 * Dashboard section navigation. Vertical, sticky list on desktop; a horizontal
 * scrolling strip of pills on mobile.
 */
export function DashboardSidebar({ items, active, onSelect }: Props) {
  return (
    <nav
      aria-label="Dashboard sections"
      className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible lg:sticky lg:top-24 pb-2 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0"
    >
      {items.map((it) => {
        const Icon = it.icon
        const isActive = it.id === active
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onSelect(it.id)}
            aria-current={isActive ? 'page' : undefined}
            className={clsx(
              'flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 border',
              isActive
                ? 'bg-brand-500/15 text-white border-brand-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
            )}
          >
            <Icon size={16} className={isActive ? 'text-brand-400' : 'text-slate-500'} />
            <span>{it.label}</span>
            {it.badge !== undefined && it.badge !== 0 && (
              <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300">
                {it.badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
