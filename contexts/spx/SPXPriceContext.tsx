'use client'

import { createContext, useContext } from 'react'
import type { ChartTimeframe } from '@/lib/api/ai-coach'

type SPXPriceSource = 'tick' | 'poll' | 'snapshot' | null

export interface SPXRealtimeMicrobar {
  symbol: string
  interval: '1s' | '5s'
  bucketStartMs: number
  bucketEndMs: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  trades: number
  finalized: boolean
  timestamp: string
}

export interface SPXPriceContextState {
  spxPrice: number
  spxTickTimestamp: string | null
  spxPriceAgeMs: number | null
  spxPriceSource: SPXPriceSource
  spyPrice: number
  snapshotGeneratedAt: string | null
  priceStreamConnected: boolean
  priceStreamError: string | null
  selectedTimeframe: ChartTimeframe
  setChartTimeframe: (timeframe: ChartTimeframe) => void
  latestMicrobar: SPXRealtimeMicrobar | null
}

const SPXPriceContext = createContext<SPXPriceContextState | null>(null)

export function SPXPriceProvider({
  value,
  children,
}: {
  value: SPXPriceContextState
  children: React.ReactNode
}) {
  return (
    <SPXPriceContext.Provider value={value}>
      {children}
    </SPXPriceContext.Provider>
  )
}

export function useSPXPriceContext() {
  const context = useContext(SPXPriceContext)
  if (!context) {
    throw new Error('useSPXPriceContext must be used inside SPXPriceProvider')
  }

  return context
}
