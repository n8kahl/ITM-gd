'use client'

import { useSPXQuery } from '@/hooks/use-spx-api'
import type { Setup } from '@/lib/types/spx-command-center'

interface SetupsResponse {
  setups: Setup[]
  count: number
  generatedAt: string
}

export function useSPXSetups() {
  const query = useSPXQuery<SetupsResponse>('/api/spx/setups', {
    refreshInterval: 10_000,
  })

  return {
    setups: query.data?.setups || [],
    count: query.data?.count || 0,
    generatedAt: query.data?.generatedAt || null,
    isLoading: query.isLoading,
    error: query.error,
    mutate: query.mutate,
  }
}
