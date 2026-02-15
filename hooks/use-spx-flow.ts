'use client'

import { useSPXQuery } from '@/hooks/use-spx-api'

interface FlowEvent {
  id: string
  type: 'sweep' | 'block'
  symbol: 'SPX' | 'SPY'
  strike: number
  expiry: string
  size: number
  direction: 'bullish' | 'bearish'
  premium: number
  timestamp: string
}

interface FlowResponse {
  events: FlowEvent[]
  count: number
  generatedAt: string
}

export function useSPXFlow() {
  const query = useSPXQuery<FlowResponse>('/api/spx/flow', {
    refreshInterval: 5_000,
  })

  return {
    events: query.data?.events || [],
    count: query.data?.count || 0,
    generatedAt: query.data?.generatedAt || null,
    isLoading: query.isLoading,
    error: query.error,
    mutate: query.mutate,
  }
}
