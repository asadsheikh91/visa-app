'use client'

import { useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createInterviewApi, type InterviewApi } from '@/lib/api'

export function useInterviewApi(): InterviewApi {
  const { getToken } = useAuth()
  return useMemo(
    () => createInterviewApi(() => getToken()),
    [getToken]
  )
}
