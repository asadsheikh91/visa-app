'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createDocumentGuidanceApi, type DocumentGuidanceApi } from '@/lib/api'

export function useDocumentGuidanceApi(): DocumentGuidanceApi {
  const { getToken } = useAuth()
  return useMemo(
    () => createDocumentGuidanceApi(() => getToken()),
    [getToken]
  )
}
