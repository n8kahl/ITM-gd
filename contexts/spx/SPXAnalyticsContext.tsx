'use client'

import { createContext, useContext } from 'react'
import type { SPXFeedFallbackReasonCode, SPXFeedFallbackStage } from '@/lib/spx/feed-health'
import type {
  BasisState,
  ClusterZone,
  FibLevel,
  GEXProfile,
  PredictionState,
  Regime,
  SPXLevel,
  SpyImpactState,
} from '@/lib/types/spx-command-center'

export interface SPXAnalyticsContextState {
  dataHealth: 'healthy' | 'degraded' | 'stale'
  dataHealthMessage: string | null
  feedFallbackStage: SPXFeedFallbackStage
  feedFallbackReasonCode: SPXFeedFallbackReasonCode
  blockTradeEntryByFeedTrust: boolean
  basis: BasisState | null
  spyImpact: SpyImpactState | null
  regime: Regime | null
  prediction: PredictionState | null
  levels: SPXLevel[]
  clusterZones: ClusterZone[]
  fibLevels: FibLevel[]
  gexProfile: { spx: GEXProfile; spy: GEXProfile; combined: GEXProfile } | null
  isLoading: boolean
  error: Error | null
}

const SPXAnalyticsContext = createContext<SPXAnalyticsContextState | null>(null)

export function SPXAnalyticsProvider({
  value,
  children,
}: {
  value: SPXAnalyticsContextState
  children: React.ReactNode
}) {
  return (
    <SPXAnalyticsContext.Provider value={value}>
      {children}
    </SPXAnalyticsContext.Provider>
  )
}

export function useSPXAnalyticsContext() {
  const context = useContext(SPXAnalyticsContext)
  if (!context) {
    throw new Error('useSPXAnalyticsContext must be used inside SPXAnalyticsProvider')
  }

  return context
}
