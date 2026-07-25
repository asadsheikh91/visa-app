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
    <section className="mt-6 rounded-[4px] border border-hairline bg-white p-6 shadow-[6px_6px_0_0] shadow-ink/10" aria-labelledby="pof-heading">
      <div className="mb-4 flex items-center gap-2.5">
        <Wallet size={18} className="text-stamp" aria-hidden="true" />
        <h3 id="pof-heading" className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
          Proof-of-funds converter
        </h3>
      </div>

      <label htmlFor="pof-amount" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-support">
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
          <p className="flex items-center gap-2 font-body text-sm text-support">
            <Loader2 size={14} className="animate-spin text-stamp" aria-hidden="true" />
            Converting…
          </p>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2 rounded-[3px] border border-hairline bg-paper-deep p-3">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-seal-text" aria-hidden="true" />
            <p className="font-body text-xs text-ink">Currency conversion is temporarily unavailable.</p>
          </div>
        )}

        {!loading && !error && converted != null && amount != null && (
          <dl className="space-y-2 font-body text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-support">Your entered funds</dt>
              <dd className="font-mono font-medium text-ink">{formatMoney(amount, 'PKR')}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-support">Approximate converted value</dt>
              <dd className="font-mono font-semibold text-ink">{formatMoney(converted, target)}</dd>
            </div>

            {requiredAmount != null && (
              <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2">
                <dt className="text-support">Required estimated funds</dt>
                <dd className="font-mono font-medium text-ink">{formatMoney(requiredAmount, target)}</dd>
              </div>
            )}

            {shortfall != null && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-seal-text">Estimated shortfall</dt>
                <dd className="text-right font-mono font-semibold text-seal-text">
                  {formatMoney(shortfall, target)}
                  {shortfallPkr != null && (
                    <span className="block text-xs font-normal text-support">
                      ≈ {formatMoney(shortfallPkr, 'PKR')}
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <p id="pof-disclaimer" className="mt-4 font-body text-xs leading-relaxed text-support">
        {DISCLAIMER}
      </p>
    </section>
  )
}
