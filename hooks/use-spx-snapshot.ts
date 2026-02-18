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
  SpyImpactState,
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
  degraded?: boolean
  message?: string
  levels: SPXLevel[]
  clusters: ClusterZone[]
  fibLevels: FibLevel[]
  gex: {
    spx: GEXProfile
    spy: GEXProfile
    combined: GEXProfile
  }
  basis: BasisState
  spyImpact: SpyImpactState
  setups: Setup[]
  regime: SPXSnapshotRegimeState
  prediction: PredictionState
  flow: SPXFlowEvent[]
  coachMessages: CoachMessage[]
  generatedAt: string
}

// Price/mini-bars stream over websocket; slower snapshot cadence reduces UI churn.
const SNAPSHOT_BASE_REFRESH_MS = 8_000
const SNAPSHOT_MAX_REFRESH_MS = 120_000
const SNAPSHOT_TRANSIENT_ERROR_PATTERN = /(502|503|unavailable|degraded|timeout)/i

let snapshotConsecutiveFailures = 0
let snapshotCooldownUntil = 0

function getSnapshotRefreshInterval(): number {
  const now = Date.now()
  if (snapshotCooldownUntil > now) {
    return Math.max(snapshotCooldownUntil - now, SNAPSHOT_BASE_REFRESH_MS)
  }
  return SNAPSHOT_BASE_REFRESH_MS
}

function markSnapshotFailure(error: Error): void {
  if (!SNAPSHOT_TRANSIENT_ERROR_PATTERN.test(error.message || '')) {
    snapshotConsecutiveFailures = Math.min(snapshotConsecutiveFailures + 1, 5)
  } else {
    snapshotConsecutiveFailures = Math.min(snapshotConsecutiveFailures + 1, 6)
  }

  const delay = Math.min(
    SNAPSHOT_BASE_REFRESH_MS * (2 ** Math.max(snapshotConsecutiveFailures - 1, 0)),
    SNAPSHOT_MAX_REFRESH_MS,
  )
  snapshotCooldownUntil = Date.now() + delay
}

function clearSnapshotFailureState(): void {
  snapshotConsecutiveFailures = 0
  snapshotCooldownUntil = 0
}

export function useSPXSnapshot() {
  const query = useSPXQuery<SPXSnapshotResponse>('/api/spx/snapshot', {
    refreshInterval: () => getSnapshotRefreshInterval(),
    revalidateOnFocus: false,
    errorRetryCount: 0,
    onError: (error) => {
      markSnapshotFailure(error)
    },
    onSuccess: () => {
      clearSnapshotFailureState()
    },
  })

  return {
    snapshot: query.data || null,
    isDegraded: query.data?.degraded === true,
    degradedMessage: typeof query.data?.message === 'string' ? query.data.message : null,
    isLoading: query.isLoading,
    error: query.error,
    mutate: query.mutate,
  }
}
