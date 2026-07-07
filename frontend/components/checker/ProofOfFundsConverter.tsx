'use client'

import { useState } from 'react'
import { AlertCircle, Loader2, Wallet } from 'lucide-react'
import type { CountrySlug } from '@/lib/countries'
import { COUNTRY_CURRENCY, formatMoney } from '@/lib/currency'
import { useCurrencyConversion } from '@/lib/useCurrencyConversion'

interface Props {
  country: CountrySlug
  /**
   * Optional required proof-of-funds amount, expressed in the destination
   * currency. When provided, the component shows required + shortfall. Left
   * unset for now (no authoritative per-country figure is wired yet).
   */
  requiredAmount?: number
}

const DISCLAIMER =
  'Exchange rates are estimates and may differ from bank, card, or official visa conversion rates.'

export function ProofOfFundsConverter({ country, requiredAmount }: Props) {
  const target = COUNTRY_CURRENCY[country]
  const [raw, setRaw] = useState('')

  // Parse the PKR input; null when empty/invalid so no conversion runs.
  const amount = (() => {
    const n = Number(raw.replace(/,/g, ''))
    return raw.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null
  })()

  const { data, loading, error } = useCurrencyConversion({ from: 'PKR', to: target, amount })

  const converted = data?.converted_amount ?? null
  const shortfall =
    requiredAmount != null && converted != null && converted < requiredAmount
      ? requiredAmount - converted
      : null
  // Approximate the shortfall back into PKR using the same estimate rate.
  const shortfallPkr =
    shortfall != null && data && data.rate > 0 ? shortfall / data.rate : null

  return (
    <section className="glass mt-6 rounded-2xl p-6" aria-labelledby="pof-heading">
      <div className="mb-4 flex items-center gap-2.5">
        <Wallet size={18} className="text-brand-300" aria-hidden="true" />
        <h3 id="pof-heading" className="text-sm font-semibold text-white">
          Proof-of-funds converter
        </h3>
      </div>

      <label htmlFor="pof-amount" className="mb-1.5 block text-xs text-slate-400">
        Your available funds (PKR)
      </label>
      <input
        id="pof-amount"
        inputMode="numeric"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="e.g. 1,000,000"
        className="input-base"
        aria-describedby="pof-disclaimer"
      />

      {/* Result area */}
      <div className="mt-4 min-h-[2.5rem]" aria-live="polite">
        {loading && (
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 size={14} className="animate-spin text-brand-400" aria-hidden="true" />
            Converting…
          </p>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2 rounded-xl border border-line-1 bg-tint-1 p-3">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-readiness-mid" aria-hidden="true" />
            <p className="text-xs text-slate-300">Currency conversion is temporarily unavailable.</p>
          </div>
        )}

        {!loading && !error && converted != null && amount != null && (
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Your entered funds</dt>
              <dd className="font-medium text-slate-200">{formatMoney(amount, 'PKR')}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Approximate converted value</dt>
              <dd className="font-semibold text-white">{formatMoney(converted, target)}</dd>
            </div>

            {requiredAmount != null && (
              <div className="flex items-center justify-between gap-3 border-t border-line-1 pt-2">
                <dt className="text-slate-400">Required estimated funds</dt>
                <dd className="font-medium text-slate-200">{formatMoney(requiredAmount, target)}</dd>
              </div>
            )}

            {shortfall != null && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-readiness-mid">Estimated shortfall</dt>
                <dd className="text-right font-semibold text-readiness-mid">
                  {formatMoney(shortfall, target)}
                  {shortfallPkr != null && (
                    <span className="block text-xs font-normal text-slate-500">
                      ≈ {formatMoney(shortfallPkr, 'PKR')}
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <p id="pof-disclaimer" className="mt-4 text-xs leading-relaxed text-slate-600">
        {DISCLAIMER}
      </p>
    </section>
  )
}
