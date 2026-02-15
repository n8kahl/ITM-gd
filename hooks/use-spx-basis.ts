'use client'

import { useSPXQuery } from '@/hooks/use-spx-api'
import type { BasisState } from '@/lib/types/spx-command-center'

export function useSPXBasis() {
  const query = useSPXQuery<BasisState>('/api/spx/basis', {
    refreshInterval: 5_000,
  })

  return {
    basis: query.data || null,
    isLoading: query.isLoading,
    error: query.error,
    mutate: query.mutate,
  }
}
