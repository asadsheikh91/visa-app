'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, ArrowUpDown, Loader2, X } from 'lucide-react'
import clsx from 'clsx'
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_LABEL,
  formatMoney,
  type CurrencyCode,
} from '@/lib/currency'
import { useCurrencyConversion } from '@/lib/useCurrencyConversion'

/**
 * Global currency converter — mounted in the navbar (signed-in users only) so it
 * is reachable from every tab/module, not just the visa checker. Unlike the
 * proof-of-funds converter (fixed PKR → destination), here the user picks BOTH
 * the "from" and "to" currencies from the supported set.
 *
 * Talks only to our own authenticated /currency endpoint via useCurrencyConversion.
 */

const DISCLAIMER =
  'Estimated rates — may differ from bank, card, or official visa conversion rates.'

export function CurrencyConverterWidget() {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState<CurrencyCode>('PKR')
  const [to, setTo] = useState<CurrencyCode>('GBP')
  const [raw, setRaw] = useState('')

  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Parse the typed amount; null when empty/invalid so no conversion runs.
  const amount = (() => {
    const n = Number(raw.replace(/,/g, ''))
    return raw.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null
  })()

  const { data, loading, error } = useCurrencyConversion({ from, to, amount })
  const converted = data?.converted_amount ?? null

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Currency converter"
        className={clsx(
          'flex items-center gap-1.5 rounded-[3px] border px-3 py-2 font-body text-sm font-medium transition-colors duration-200',
          open
            ? 'border-stamp bg-stamp/[0.06] text-ink'
            : 'border-hairline bg-white text-support hover:border-support hover:text-ink'
        )}
      >
        <ArrowRightLeft size={15} aria-hidden="true" />
        <span className="hidden sm:inline">Currency</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Currency converter"
          className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-[4px] border border-hairline bg-white p-4 shadow-[6px_6px_0_0] shadow-ink/10"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">Currency converter</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-[3px] p-1 text-support transition-colors hover:bg-paper-deep hover:text-ink"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <label htmlFor="cc-amount" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-support">
            Amount
          </label>
          <input
            id="cc-amount"
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="e.g. 1,000,000"
            className="input-base"
            autoFocus
          />

          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div>
              <label htmlFor="cc-from" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-support">
                From
              </label>
              <CurrencySelect id="cc-from" value={from} onChange={setFrom} />
            </div>

            <button
              type="button"
              onClick={swap}
              aria-label="Swap currencies"
              className="mb-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[3px] border border-hairline bg-white text-support transition-colors hover:border-stamp hover:text-ink"
            >
              <ArrowUpDown size={15} aria-hidden="true" />
            </button>

            <div>
              <label htmlFor="cc-to" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-support">
                To
              </label>
              <CurrencySelect id="cc-to" value={to} onChange={setTo} />
            </div>
          </div>

          {/* Result */}
          <div className="mt-4 min-h-[3.25rem]" aria-live="polite">
            {amount == null && (
              <p className="font-body text-xs text-support">Enter an amount to convert.</p>
            )}

            {amount != null && loading && (
              <p className="flex items-center gap-2 font-body text-sm text-support">
                <Loader2 size={14} className="animate-spin text-stamp" aria-hidden="true" />
                Converting…
              </p>
            )}

            {amount != null && !loading && error && (
              <p className="font-body text-xs text-seal-text">{error}</p>
            )}

            {amount != null && !loading && !error && converted != null && data && (
              <div className="rounded-[3px] border border-hairline bg-paper-deep p-3">
                <div className="font-mono text-lg font-semibold text-ink">
                  {formatMoney(converted, to)}
                </div>
                <div className="mt-1 font-mono text-xs text-support">
                  {formatMoney(amount, from)} · 1 {from} = {data.rate.toPrecision(4)} {to}
                </div>
              </div>
            )}
          </div>

          <p className="mt-3 font-body text-[11px] leading-relaxed text-support">{DISCLAIMER}</p>
        </div>
      )}
    </div>
  )
}

function CurrencySelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: CurrencyCode
  onChange: (c: CurrencyCode) => void
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as CurrencyCode)}
      className="w-full rounded-[3px] border border-hairline bg-white px-3 py-2 font-body text-sm text-ink outline-none transition-colors focus:border-stamp"
    >
      {SUPPORTED_CURRENCIES.map((c) => (
        <option key={c} value={c} className="bg-white text-ink">
          {c} — {CURRENCY_LABEL[c]}
        </option>
      ))}
    </select>
  )
}
