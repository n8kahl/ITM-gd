'use client'

import { useSPXQuery } from '@/hooks/use-spx-api'
import type {
  BasisState,
  ClusterZone,
  CoachMessage,
  FibLevel,
  FlowEvent,
  FlowWindowAggregation,
  GEXProfile,
  PredictionState,
  Regime,
  SpyImpactState,
  SPXEnvironmentGateDecision,
  Setup,
  SPXStandbyGuidance,
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

interface SPXSnapshotResponse {
  degraded?: boolean
  message?: string
  levelsDataQuality?: {
    integrity: 'full' | 'degraded'
    warnings?: string[]
  } | null
  dataQuality?: {
    integrity?: 'full' | 'degraded'
    warnings?: string[]
    generatedAt?: string
    degraded?: boolean
    degradedReasons?: string[]
    stages?: Record<string, {
      ok?: boolean
      source?: string
      freshnessMs?: number
      degradedReason?: string | null
    }>
  } | null
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
  flow: FlowEvent[]
  flowAggregation?: FlowWindowAggregation | null
  coachMessages: CoachMessage[]
  environmentGate?: SPXEnvironmentGateDecision | null
  standbyGuidance?: SPXStandbyGuidance | null
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

function getStageDegradedReasons(snapshot: SPXSnapshotResponse | null): string[] {
  if (!snapshot?.dataQuality || typeof snapshot.dataQuality !== 'object') return []
  const stageReasons = new Set<string>()

  const degradedReasons = Array.isArray(snapshot.dataQuality.degradedReasons)
    ? snapshot.dataQuality.degradedReasons
    : []
  for (const degradedReason of degradedReasons) {
    if (typeof degradedReason === 'string' && degradedReason.trim().length > 0) {
      stageReasons.add(degradedReason.trim())
    }
  }

  const stages = snapshot.dataQuality.stages
  if (stages && typeof stages === 'object') {
    for (const [stage, quality] of Object.entries(stages)) {
      if (!quality || typeof quality !== 'object') continue
      if (quality.ok !== false) continue
      const degradedReason = typeof quality.degradedReason === 'string' && quality.degradedReason.trim().length > 0
        ? quality.degradedReason.trim()
        : 'fallback'
      stageReasons.add(`${stage}:${degradedReason}`)
    }
  }

  return Array.from(stageReasons)
}

function resolveSnapshotDegradedState(snapshot: SPXSnapshotResponse | null): {
  isDegraded: boolean
  message: string | null
} {
  const stageDegradedReasons = getStageDegradedReasons(snapshot)
  const dataQuality = snapshot?.dataQuality && typeof snapshot.dataQuality === 'object'
    ? snapshot.dataQuality
    : null
  const legacyIntegrity = dataQuality?.integrity
  const legacyWarnings = Array.isArray(dataQuality?.warnings)
    ? dataQuality.warnings.filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0)
    : []
  const stageDegraded = dataQuality?.degraded === true || stageDegradedReasons.length > 0
  const legacyDegraded = legacyIntegrity === 'degraded'
  const flagDegraded = snapshot?.degraded === true
  const isDegraded = flagDegraded || stageDegraded || legacyDegraded

  if (!isDegraded) {
    return {
      isDegraded: false,
      message: null,
    }
  }

  const explicitMessage = typeof snapshot?.message === 'string' && snapshot.message.trim().length > 0
    ? snapshot.message.trim()
    : null
  if (explicitMessage) {
    return {
      isDegraded: true,
      message: explicitMessage,
    }
  }

  const reasons = stageDegradedReasons.length > 0
    ? stageDegradedReasons
    : legacyWarnings
  if (reasons.length > 0) {
    return {
      isDegraded: true,
      message: `SPX snapshot degraded: ${reasons.slice(0, 3).join(' · ')}`,
    }
  }

  return {
    isDegraded: true,
    message: 'SPX snapshot degraded.',
  }
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
  const resolvedDegradedState = resolveSnapshotDegradedState(query.data || null)

  return {
    snapshot: query.data || null,
    isDegraded: resolvedDegradedState.isDegraded,
    degradedMessage: resolvedDegradedState.message,
    isLoading: query.isLoading,
    error: query.error,
    mutate: query.mutate,
  }
}
