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
              'flex flex-shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[3px] border-l-2 px-3.5 py-2.5 font-body text-sm font-medium transition-colors',
              isActive
                ? 'border-l-stamp bg-white text-ink'
                : 'border-l-transparent text-support hover:bg-white hover:text-ink'
            )}
          >
            <Icon size={16} className={isActive ? 'text-stamp' : 'text-support'} />
            <span>{it.label}</span>
            {it.badge !== undefined && it.badge !== 0 && (
              <span className="ml-auto rounded-[3px] bg-stamp/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-stamp">
                {it.badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
