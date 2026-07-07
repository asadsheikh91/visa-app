'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createSopApi, type SopApi } from '@/lib/api'

export function useSopApi(): SopApi {
  const { getToken } = useAuth()
  return useMemo(
    () => createSopApi(() => getToken()),
    [getToken]
  )
}
