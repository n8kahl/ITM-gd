'use client'

import { createBrowserSupabase } from '@/lib/supabase-browser'

let refreshPromise: Promise<string | null> | null = null

export async function refreshBrowserAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const supabase = createBrowserSupabase()
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!currentSession?.refresh_token) {
        return null
      }

      const {
        data: { session: refreshedSession },
        error,
      } = await supabase.auth.refreshSession()

      if (error || !refreshedSession?.access_token) {
        return null
      }

      return refreshedSession.access_token
    })().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}
