'use client'

/**
 * Tabs — an accessible, keyboard-operable tab primitive.
 *
 * Implements the WAI-ARIA Tabs pattern with automatic activation:
 *   - roving tabindex (only the selected tab is in the tab order)
 *   - Left/Right (and Up/Down) arrows move between tabs and select
 *   - Home / End jump to the first / last tab
 *   - aria-selected / aria-controls / aria-labelledby wired to real ids
 *
 * Controlled: the parent owns `value` so it can read the active tab for
 * content outside the panels (e.g. a country-specific CTA).
 *
 *   <Tabs value={slug} onValueChange={setSlug}>
 *     <TabList label="Select a country" className="grid grid-cols-2 …">
 *       <Tab value="uk">🇬🇧 United Kingdom</Tab>
 *     </TabList>
 *     <TabPanel value="uk" className="glass …">…</TabPanel>
 *   </Tabs>
 */

import {
  createContext,
  useContext,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import clsx from 'clsx'

interface TabsContextValue {
  value: string
  setValue: (value: string) => void
  idFor: (value: string) => { tab: string; panel: string }
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error(`<${component}> must be used inside <Tabs>`)
  return ctx
}

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  const baseId = useId()
  const idFor = (v: string) => ({
    tab: `${baseId}tab-${v}`,
    panel: `${baseId}panel-${v}`,
  })
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange, idFor }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabListProps {
  /** Accessible name for the tablist (maps to aria-label). */
  label: string
  children: ReactNode
  className?: string
}

export function TabList({ label, children, className }: TabListProps) {
  const { value, setValue } = useTabsContext('TabList')
  const ref = useRef<HTMLDivElement>(null)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []
    )
    if (tabs.length === 0) return

    const current = tabs.findIndex((t) => t.dataset.value === value)
    let nextIndex: number

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (current + 1) % tabs.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (current - 1 + tabs.length) % tabs.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = tabs.length - 1
        break
      default:
        return
    }

    e.preventDefault()
    const next = tabs[nextIndex]
    const nextValue = next.dataset.value
    if (nextValue) {
      setValue(nextValue)
      next.focus()
    }
  }

  return (
    <div ref={ref} role="tablist" aria-label={label} onKeyDown={onKeyDown} className={className}>
      {children}
    </div>
  )
}

const tabBase =
  'flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ' +
  'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60'
const tabSelected = 'border-brand-500/50 bg-brand-600/20 text-brand-200'
const tabIdle = 'border-line-1 bg-tint-2 text-slate-300 hover:border-line-3 hover:bg-tint-4'

interface TabProps {
  value: string
  children: ReactNode
  className?: string
}

export function Tab({ value: tabValue, children, className }: TabProps) {
  const { value, setValue, idFor } = useTabsContext('Tab')
  const selected = value === tabValue
  const ids = idFor(tabValue)
  return (
    <button
      type="button"
      role="tab"
      id={ids.tab}
      data-value={tabValue}
      aria-selected={selected}
      aria-controls={ids.panel}
      tabIndex={selected ? 0 : -1}
      onClick={() => setValue(tabValue)}
      className={clsx(tabBase, selected ? tabSelected : tabIdle, className)}
    >
      {children}
    </button>
  )
}

interface TabPanelProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabPanel({ value: panelValue, children, className }: TabPanelProps) {
  const { value, idFor } = useTabsContext('TabPanel')
  if (value !== panelValue) return null
  const ids = idFor(panelValue)
  return (
    <div
      role="tabpanel"
      id={ids.panel}
      aria-labelledby={ids.tab}
      tabIndex={0}
      className={clsx('focus-visible:outline-none', className)}
    >
      {children}
    </div>
  )
}
