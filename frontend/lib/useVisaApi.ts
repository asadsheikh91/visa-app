'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createVisaApi, type VisaApi } from '@/lib/api'

/**
 * React hook exposing the visa API bound to the current Clerk session.
 * Every request fetches a fresh Clerk JWT and sends it as a Bearer token,
 * which the backend verifies and uses to upsert the user (id + email).
 */
export function useVisaApi(): VisaApi {
  const { getToken } = useAuth()
  return useMemo(
    () => createVisaApi(() => getToken()),
    [getToken]
  )
}
