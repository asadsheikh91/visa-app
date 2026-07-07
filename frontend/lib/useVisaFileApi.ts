'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createVisaFileApi, type VisaFileApi } from '@/lib/api'

export function useVisaFileApi(): VisaFileApi {
  const { getToken } = useAuth()
  return useMemo(
    () => createVisaFileApi(() => getToken()),
    [getToken]
  )
}
