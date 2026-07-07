'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createOrgApi, type OrgApi } from '@/lib/api'

export function useOrgApi(): OrgApi {
  const { getToken } = useAuth()
  return useMemo(
    () => createOrgApi(() => getToken()),
    [getToken]
  )
}
