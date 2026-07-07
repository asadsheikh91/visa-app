'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createJourneyApi, type JourneyApi } from '@/lib/api'

export function useJourneyApi(): JourneyApi {
  const { getToken } = useAuth()
  return useMemo(
    () => createJourneyApi(() => getToken()),
    [getToken]
  )
}
