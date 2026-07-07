'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createReportApi, type ReportApi } from '@/lib/api'

/** Readiness Report API bound to the current Clerk session. */
export function useReportApi(): ReportApi {
  const { getToken } = useAuth()
  return useMemo(() => createReportApi(() => getToken()), [getToken])
}
