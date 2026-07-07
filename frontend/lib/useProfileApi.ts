'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createProfileApi, type ProfileApi } from '@/lib/api'

export function useProfileApi(): ProfileApi {
  const { getToken } = useAuth()
  return useMemo(
    () => createProfileApi(() => getToken()),
    [getToken]
  )
}
