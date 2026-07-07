'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createOutcomeApi, type OutcomeApi } from '@/lib/api'

export function useOutcomeApi(): OutcomeApi {
  const { getToken } = useAuth()
  return useMemo(
    () => createOutcomeApi(() => getToken()),
    [getToken]
  )
}
