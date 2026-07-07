'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import {
  convertCurrency,
  type ConversionResult,
  type CurrencyCode,
} from '@/lib/currency'

interface Args {
  from: CurrencyCode
  to: CurrencyCode
  amount: number | null
  /** Debounce in ms for live-typed amounts. Default 400. */
  debounceMs?: number
}

interface State {
  data: ConversionResult | null
  loading: boolean
  /** User-facing message when conversion is unavailable; null when fine. */
  error: string | null
}

/**
 * Convert `amount` from→to via our backend, debounced. Conversion failures are
 * surfaced as a friendly `error` string (never thrown), so callers can show a
 * graceful fallback without crashing the visa checker.
 *
 * No conversion runs when `amount` is null or <= 0.
 */
export function useCurrencyConversion({ from, to, amount, debounceMs = 400 }: Args): State {
  const { getToken } = useAuth()
  const [state, setState] = useState<State>({ data: null, loading: false, error: null })
  // Guards against out-of-order responses overwriting newer ones.
  const reqId = useRef(0)

  const run = useCallback(
    async (value: number) => {
      const id = ++reqId.current
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        // /currency is Clerk-authenticated; send a fresh token per request.
        const token = await getToken()
        const data = await convertCurrency({ from, to, amount: value, token })
        if (id === reqId.current) setState({ data, loading: false, error: null })
      } catch (e) {
        if (id === reqId.current) {
          const msg = e instanceof Error ? e.message : 'Currency conversion is temporarily unavailable.'
          setState({ data: null, loading: false, error: msg })
        }
      }
    },
    [from, to, getToken]
  )

  useEffect(() => {
    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      reqId.current++ // cancel any in-flight result
      setState({ data: null, loading: false, error: null })
      return
    }
    const t = setTimeout(() => run(amount), debounceMs)
    return () => clearTimeout(t)
  }, [amount, run, debounceMs])

  return state
}
