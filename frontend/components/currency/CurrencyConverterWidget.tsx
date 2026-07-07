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
          'flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-all duration-200',
          open
            ? 'border-[#ff5a1f]/50 bg-[#ff5a1f]/10 text-white'
            : 'border-white/[0.12] bg-white/[0.03] text-slate-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06]'
        )}
      >
        <ArrowRightLeft size={15} aria-hidden="true" />
        <span className="hidden sm:inline">Currency</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Currency converter"
          className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-white/[0.1] bg-[#0f0d0b]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Currency converter</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <label htmlFor="cc-amount" className="mb-1.5 block text-xs text-slate-400">
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
              <label htmlFor="cc-from" className="mb-1.5 block text-xs text-slate-400">
                From
              </label>
              <CurrencySelect id="cc-from" value={from} onChange={setFrom} />
            </div>

            <button
              type="button"
              onClick={swap}
              aria-label="Swap currencies"
              className="mb-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.03] text-slate-300 transition-colors hover:border-[#ff5a1f]/50 hover:text-white"
            >
              <ArrowUpDown size={15} aria-hidden="true" />
            </button>

            <div>
              <label htmlFor="cc-to" className="mb-1.5 block text-xs text-slate-400">
                To
              </label>
              <CurrencySelect id="cc-to" value={to} onChange={setTo} />
            </div>
          </div>

          {/* Result */}
          <div className="mt-4 min-h-[3.25rem]" aria-live="polite">
            {amount == null && (
              <p className="text-xs text-slate-500">Enter an amount to convert.</p>
            )}

            {amount != null && loading && (
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin text-[#ff5a1f]" aria-hidden="true" />
                Converting…
              </p>
            )}

            {amount != null && !loading && error && (
              <p className="text-xs text-[#f59e0b]">{error}</p>
            )}

            {amount != null && !loading && !error && converted != null && data && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="text-lg font-semibold text-white">
                  {formatMoney(converted, to)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {formatMoney(amount, from)} · 1 {from} = {data.rate.toPrecision(4)} {to}
                </div>
              </div>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-600">{DISCLAIMER}</p>
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
      className="w-full rounded-lg border border-white/[0.12] bg-[#161311] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-[#ff5a1f]/60"
    >
      {SUPPORTED_CURRENCIES.map((c) => (
        <option key={c} value={c} className="bg-[#161311] text-slate-100">
          {c} — {CURRENCY_LABEL[c]}
        </option>
      ))}
    </select>
  )
}
