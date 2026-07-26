'use client'

import { useMemo, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createAdminApi, type AdminApi } from '@/lib/api'

/** Admin API bound to the current Clerk session. */
export function useAdminApi(): AdminApi {
  const { getToken } = useAuth()
  return useMemo(() => createAdminApi(() => getToken()), [getToken])
}

type AdminState = { loading: boolean; isAdmin: boolean }

/**
 * Whether the signed-in user is an admin. Calls /api/admin/me once; a 403 (or any
 * error) resolves to not-admin. Used to conditionally show the Admin nav link.
 * The backend enforces admin authorization on every call regardless of this.
 */
export function useIsAdmin(): AdminState {
  const { isLoaded, isSignedIn } = useAuth()
  const api = useAdminApi()
  const [state, setState] = useState<AdminState>({ loading: true, isAdmin: false })

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setState({ loading: false, isAdmin: false })
      return
    }
    let cancelled = false
    api
      .me()
      .then((r) => { if (!cancelled) setState({ loading: false, isAdmin: !!r.admin }) })
      // 403 → not an admin; any other error → fail closed (not-admin).
      .catch(() => { if (!cancelled) setState({ loading: false, isAdmin: false }) })
    return () => { cancelled = true }
  }, [api, isLoaded, isSignedIn])

  return state
}
