'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createTimelineApi, type TimelineApi } from '@/lib/api'

export function useTimelineApi(): TimelineApi {
  const { getToken } = useAuth()
  return useMemo(
    () => createTimelineApi(() => getToken()),
    [getToken]
  )
}
