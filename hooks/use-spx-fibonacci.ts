'use client'

import { useSPXQuery } from '@/hooks/use-spx-api'
import type { FibLevel } from '@/lib/types/spx-command-center'

interface FibResponse {
  levels: FibLevel[]
  count: number
  generatedAt: string
}

export function useSPXFibonacci() {
  const query = useSPXQuery<FibResponse>('/api/spx/fibonacci', {
    refreshInterval: 30_000,
  })

  return {
    fibLevels: query.data?.levels || [],
    count: query.data?.count || 0,
    generatedAt: query.data?.generatedAt || null,
    isLoading: query.isLoading,
    error: query.error,
    mutate: query.mutate,
  }
}
