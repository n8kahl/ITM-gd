'use client'

import { useSPXQuery } from '@/hooks/use-spx-api'
import type {
  BasisState,
  ClusterZone,
  CoachMessage,
  FibLevel,
  GEXProfile,
  PredictionState,
  Regime,
  Setup,
  SPXLevel,
} from '@/lib/types/spx-command-center'

interface SPXSnapshotRegimeState {
  regime: Regime
  direction: 'bullish' | 'bearish' | 'neutral'
  probability: number
  magnitude: 'small' | 'medium' | 'large'
  confidence: number
  timestamp: string
}

interface SPXFlowEvent {
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

interface SPXSnapshotResponse {
  levels: SPXLevel[]
  clusters: ClusterZone[]
  fibLevels: FibLevel[]
  gex: {
    spx: GEXProfile
    spy: GEXProfile
    combined: GEXProfile
  }
  basis: BasisState
  setups: Setup[]
  regime: SPXSnapshotRegimeState
  prediction: PredictionState
  flow: SPXFlowEvent[]
  coachMessages: CoachMessage[]
  generatedAt: string
}

export function useSPXSnapshot() {
  const query = useSPXQuery<SPXSnapshotResponse>('/api/spx/snapshot', {
    refreshInterval: 5_000,
  })

  return {
    snapshot: query.data || null,
    isLoading: query.isLoading,
    error: query.error,
    mutate: query.mutate,
  }
}
