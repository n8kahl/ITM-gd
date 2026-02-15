'use client'

import { useSPXQuery } from '@/hooks/use-spx-api'
import type { GEXProfile } from '@/lib/types/spx-command-center'

interface GEXResponse {
  spx: GEXProfile
  spy: GEXProfile
  combined: GEXProfile
}

export function useSPXGEX() {
  const query = useSPXQuery<GEXResponse>('/api/spx/gex', {
    refreshInterval: 15_000,
  })

  return {
    gex: query.data || null,
    isLoading: query.isLoading,
    error: query.error,
    mutate: query.mutate,
  }
}
