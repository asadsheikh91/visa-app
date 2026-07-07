// Currency conversion client — talks ONLY to our own backend, never to the
// external provider. A support layer for visa-readiness proof-of-funds display.

import type { CountrySlug } from '@/lib/countries'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export type CurrencyCode = 'PKR' | 'GBP' | 'USD' | 'CAD' | 'AUD'

// Which destination currency matters for each country's proof-of-funds.
export const COUNTRY_CURRENCY: Record<CountrySlug, CurrencyCode> = {
  uk: 'GBP',
  usa: 'USD',
  canada: 'CAD',
  australia: 'AUD',
}

// Symbols for display only.
export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  PKR: 'Rs',
  GBP: '£',
  USD: '$',
  CAD: 'C$',
  AUD: 'A$',
}

// The currencies the backend supports (must mirror currency_service.
// SUPPORTED_CURRENCIES). Order = how they appear in the converter dropdowns:
// PKR first (the user's home currency), then the study-destination currencies.
export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = ['PKR', 'GBP', 'USD', 'CAD', 'AUD']

// Human-readable label for each dropdown option.
export const CURRENCY_LABEL: Record<CurrencyCode, string> = {
  PKR: 'Pakistani Rupee',
  GBP: 'British Pound',
  USD: 'US Dollar',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
}

export interface ConversionResult {
  from: CurrencyCode
  to: CurrencyCode
  amount: number
  converted_amount: number
  rate: number
  provider: string
  last_updated: string
  is_estimate: boolean
}

export interface RatesResult {
  base: CurrencyCode
  rates: Partial<Record<CurrencyCode, number>>
  provider: string
  last_updated: string
  is_estimate: boolean
}

export class CurrencyError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'CurrencyError'
    this.status = status
  }
}

// The /currency endpoints are authenticated (Clerk JWT). Callers pass a token
// (from useAuth().getToken); a missing token surfaces as the same friendly
// "temporarily unavailable" message rather than a hard crash.
async function getJson<T>(path: string, token: string | null): Promise<T> {
  if (!token) {
    throw new CurrencyError('Please sign in to use the currency converter.', 401)
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new CurrencyError('Currency conversion is temporarily unavailable.', 0)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }))
    throw new CurrencyError(body?.error || 'Currency conversion is temporarily unavailable.', res.status)
  }
  return res.json() as Promise<T>
}

/** Convert an amount from one supported currency to another via our backend. */
export function convertCurrency({
  from,
  to,
  amount,
  token,
}: {
  from: CurrencyCode
  to: CurrencyCode
  amount: number
  token: string | null
}): Promise<ConversionResult> {
  const qs = new URLSearchParams({ from, to, amount: String(amount) })
  return getJson<ConversionResult>(`/currency/convert?${qs.toString()}`, token)
}

/** Fetch base→{GBP,USD,CAD,AUD} rates via our backend. */
export function getCurrencyRates(base: CurrencyCode = 'PKR', token: string | null = null): Promise<RatesResult> {
  const qs = new URLSearchParams({ base })
  return getJson<RatesResult>(`/currency/rates?${qs.toString()}`, token)
}

/** Format a number as a localized currency-ish string with a symbol prefix. */
export function formatMoney(amount: number, currency: CurrencyCode): string {
  return `${CURRENCY_SYMBOL[currency]} ${Math.round(amount).toLocaleString('en-US')}`
}
