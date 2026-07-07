'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createActionPlanApi, type ActionPlanApi } from '@/lib/api'

export function useActionPlanApi(): ActionPlanApi {
  const { getToken } = useAuth()
  return useMemo(
    () => createActionPlanApi(() => getToken()),
    [getToken]
  )
}
