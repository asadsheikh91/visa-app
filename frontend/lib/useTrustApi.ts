'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createTrustApi, type TrustApi } from '@/lib/api'

export function useTrustApi(): TrustApi {
  const { getToken } = useAuth()
  return useMemo(
    () => createTrustApi(() => getToken()),
    [getToken]
  )
}
