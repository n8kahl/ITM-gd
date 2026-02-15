'use client'

import { useMemo } from 'react'
import { useSPXQuery } from '@/hooks/use-spx-api'
import type { ContractRecommendation } from '@/lib/types/spx-command-center'

export function useSPXContract(setupId?: string | null) {
  const endpoint = useMemo(() => {
    if (!setupId) return '/api/spx/contract-select'
    const params = new URLSearchParams({ setupId })
    return `/api/spx/contract-select?${params.toString()}`
  }, [setupId])

  const query = useSPXQuery<ContractRecommendation>(endpoint, {
    refreshInterval: setupId ? 10_000 : 20_000,
  })

  return {
    recommendation: query.data || null,
    isLoading: query.isLoading,
    error: query.error,
    mutate: query.mutate,
  }
}
