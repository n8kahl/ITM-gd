'use client'

import { useSPXQuery } from '@/hooks/use-spx-api'
import type { PredictionState, Regime } from '@/lib/types/spx-command-center'

interface RegimeResponse {
  regime: Regime
  direction: 'bullish' | 'bearish' | 'neutral'
  probability: number
  magnitude: 'small' | 'medium' | 'large'
  confidence: number
  timestamp: string
  prediction: PredictionState
}

export function useSPXRegime() {
  const query = useSPXQuery<RegimeResponse>('/api/spx/regime', {
    refreshInterval: 5_000,
  })

  return {
    regime: query.data || null,
    prediction: query.data?.prediction || null,
    isLoading: query.isLoading,
    error: query.error,
    mutate: query.mutate,
  }
}
