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
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={32} className="text-brand-400 animate-spin" />
        <p className="text-slate-500 text-sm">Loading countries…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="glass rounded-2xl p-8 text-center border border-red-500/20">
        <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
        <p className="text-red-300 font-medium mb-4">{error}</p>
        <button onClick={load} className="btn-secondary text-sm justify-center">
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    )
  }

  if (status === 'empty') {
    return (
      <div className="glass rounded-2xl p-8 text-center border border-white/10">
        <Globe size={28} className="text-slate-500 mx-auto mb-3" />
        <p className="text-slate-300 font-medium mb-1">No countries available yet</p>
        <p className="text-slate-500 text-sm">Please check back soon.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-7 border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <Globe size={20} className="text-brand-400" />
          <h2 className="text-xl font-bold text-white">Select your destination country</h2>
        </div>
        <p className="text-slate-400 text-sm mb-6">
          Pick the country you&apos;re applying to. We&apos;ll load that country&apos;s specific questions and scoring criteria.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {countries.map(({ slug, country, visa_route }) => (
            <Link
              key={slug}
              href={`/tools/student-visa/countries/${slug}`}
              className="group text-left p-4 rounded-xl border border-white/10 bg-white/4 hover:bg-white/8 hover:border-brand-500/40 transition-all duration-150"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{COUNTRY_FLAGS[slug] || '🌍'}</span>
                <div>
                  <p className="font-semibold text-white text-sm">{country}</p>
                  <p className="text-xs text-slate-500">{visa_route}</p>
                </div>
                <ArrowRight size={14} className="text-slate-600 ml-auto group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-slate-700">
        More countries coming soon.
      </p>
    </div>
  )
}
