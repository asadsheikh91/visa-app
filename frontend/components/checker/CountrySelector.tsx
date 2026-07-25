'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, Globe, AlertCircle, RefreshCw } from 'lucide-react'
import { useVisaApi } from '@/lib/useVisaApi'
import { ApiError } from '@/lib/api'
import type { CountryMeta } from '@/types/visa'

const COUNTRY_FLAGS: Record<string, string> = {
  uk: '🇬🇧', usa: '🇺🇸', canada: '🇨🇦', australia: '🇦🇺',
}

type Status = 'loading' | 'error' | 'empty' | 'ready'

export function CountrySelector() {
  const api = useVisaApi()
  const [status, setStatus] = useState<Status>('loading')
  const [countries, setCountries] = useState<CountryMeta[]>([])
  const [error, setError] = useState<string>('')

  const load = useCallback(async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await api.getCountries()
      if (!Array.isArray(data) || data.length === 0) {
        setStatus('empty')
        return
      }
      setCountries(data)
      setStatus('ready')
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong loading countries.'
      setError(msg)
      setStatus('error')
    }
  }, [api])

  useEffect(() => { load() }, [load])

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <Loader2 size={32} className="animate-spin text-stamp" />
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-support">Loading countries…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="rounded-[4px] border border-hairline bg-white p-8 text-center shadow-[6px_6px_0_0] shadow-ink/10">
        <AlertCircle size={32} className="mx-auto mb-3 text-seal-text" />
        <p className="mb-4 font-body font-medium text-ink">{error}</p>
        <button onClick={load} className="btn-secondary text-sm">
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    )
  }

  if (status === 'empty') {
    return (
      <div className="rounded-[4px] border border-hairline bg-white p-8 text-center shadow-[6px_6px_0_0] shadow-ink/10">
        <Globe size={28} className="mx-auto mb-3 text-support" />
        <p className="mb-1 font-body font-medium text-ink">No countries available yet</p>
        <p className="font-body text-sm text-support">Please check back soon.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[4px] border border-hairline bg-white p-7 shadow-[6px_6px_0_0] shadow-ink/10">
        <div className="mb-2 flex items-center gap-3">
          <Globe size={20} className="text-stamp" />
          <h2 className="font-serif text-[22px] leading-tight text-ink">Select your destination country</h2>
        </div>
        <p className="mb-6 font-body text-sm text-support">
          Pick the country you&apos;re applying to. We&apos;ll load that country&apos;s specific questions and scoring criteria.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {countries.map(({ slug, country, visa_route }) => (
            <Link
              key={slug}
              href={`/tools/student-visa/countries/${slug}`}
              className="group rounded-[3px] border border-hairline bg-paper p-4 text-left transition-colors duration-150 hover:border-stamp"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{COUNTRY_FLAGS[slug] || '🌍'}</span>
                <div>
                  <p className="font-body text-sm font-semibold text-ink">{country}</p>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-support">{visa_route}</p>
                </div>
                <ArrowRight size={14} className="ml-auto text-support transition-transform group-hover:translate-x-0.5 group-hover:text-stamp" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-support">
        More countries coming soon.
      </p>
    </div>
  )
}
