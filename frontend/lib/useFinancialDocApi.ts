'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createFinancialDocApi, type FinancialDocApi } from '@/lib/api'

export function useFinancialDocApi(): FinancialDocApi {
  const { getToken } = useAuth()
  return useMemo(
    () => createFinancialDocApi(() => getToken()),
    [getToken]
  )
}
