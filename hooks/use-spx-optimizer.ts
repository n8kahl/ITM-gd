'use client'

import { useCallback, useMemo, useState } from 'react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { postSPX, SPXRequestError, useSPXQuery } from '@/hooks/use-spx-api'

export interface SPXOptimizerConfidenceInterval {
  sampleSize: number
  pointPct: number
  lowerPct: number
  upperPct: number
}

export interface SPXOptimizerMetrics {
  tradeCount: number
  resolvedCount: number
  t1Wins: number
  t2Wins: number
  stopsBeforeT1: number
  t1WinRatePct: number
  t2WinRatePct: number
  failureRatePct: number
  expectancyR: number
  expectancyLowerBoundR: number
  positiveRealizedRatePct: number
  objectiveScore: number
  objectiveScoreConservative: number
  t1Confidence95: SPXOptimizerConfidenceInterval
  t2Confidence95: SPXOptimizerConfidenceInterval
  failureConfidence95: SPXOptimizerConfidenceInterval
}

export interface SPXOptimizerPerformanceBucket {
  key: string
  tradeCount: number
  resolvedCount: number
  t1WinRatePct: number
  t2WinRatePct: number
  failureRatePct: number
  t1Confidence95: SPXOptimizerConfidenceInterval
  t2Confidence95: SPXOptimizerConfidenceInterval
  failureConfidence95: SPXOptimizerConfidenceInterval
}

export interface SPXOptimizerDriftAlert {
  setupType: string
  shortWindowDays: number
  longWindowDays: number
  shortT1WinRatePct: number
  shortT1Lower95Pct: number
  shortT1Upper95Pct: number
  longT1WinRatePct: number
  longT1Lower95Pct: number
  longT1Upper95Pct: number
  dropPct: number
  confidenceDropPct: number
  action: 'pause'
}

export interface SPXOptimizerDataQuality {
  failClosedActive: boolean
  gatePassed: boolean
  reasons: string[]
  warnings: string[]
  sourceUsed: 'spx_setup_instances' | 'none' | 'unknown'
  requestedResolution: 'second'
  resolutionUsed: 'second' | 'minute' | 'none' | 'unknown'
  fallbackSessionCount: number
  missingBarsSessionCount: number
  setupCount: number
  evaluatedSetupCount: number
  skippedSetupCount: number
  optimizerRows: number
  overrideRows: number
  overrideMatchedRows: number
  overrideCoveragePct: number
  optionsReplayAvailable: boolean
  optionsReplayCoveragePct: number | null
  optionsReplayCoverageFloorPct: number
  optionsReplayCoverageValid: boolean | null
  optionsReplayReplayedTrades: number
  optionsReplayUniverse: number
  executionFillTableAvailable: boolean
  executionTriggeredTradeCount: number
  executionTradesWithAnyFill: number
  executionTradesWithProxyFill: number
  executionTradesWithManualFill: number
  executionTradesWithBrokerTradierFill: number
  executionTradesWithBrokerOtherFill: number
  executionTradesWithEntryFill: number
  executionTradesWithExitFill: number
  executionTradesWithNonProxyFill: number
  executionCoveragePct: number
  executionEntryCoveragePct: number
  executionExitCoveragePct: number
  executionNonProxyCoveragePct: number
  executionProxyShareOfTriggeredPct: number
  executionProxyShareOfFilledPct: number
  executionBrokerTradierShareOfFilledPct: number
  executionEntryAvgSlippagePts: number | null
  executionExitAvgSlippagePts: number | null
  executionEntryAvgSlippageBps: number | null
  executionExitAvgSlippageBps: number | null
}

export interface SPXPromotionGovernance {
  requiredResolvedTrades: number
  observedResolvedTrades: number
  resolvedTradesPassed: boolean
  requiredSetupFamilyDiversity: number
  observedSetupFamilyDiversity: number
  setupFamilyDiversityPassed: boolean
  requiredConservativeObjectiveDelta: number
  observedConservativeObjectiveDelta: number
  conservativeObjectiveDeltaPassed: boolean
  requireExecutionFillEvidence: boolean
  observedExecutionFills: number
  executionFillEvidencePassed: boolean
  maxProxyFillSharePct: number
  observedProxyFillSharePct: number
  proxySharePassed: boolean
  promotionQualified: boolean
  reasons: string[]
}

export interface SPXOptimizerScorecard {
  generatedAt: string
  scanRange: { from: string; to: string }
  trainingRange: { from: string; to: string }
  validationRange: { from: string; to: string }
  baseline: SPXOptimizerMetrics
  optimized: SPXOptimizerMetrics
  improvementPct: {
    t1WinRateDelta: number
    t2WinRateDelta: number
    objectiveDelta: number
    objectiveConservativeDelta: number
    expectancyRDelta: number
  }
  driftAlerts: SPXOptimizerDriftAlert[]
  setupTypePerformance: SPXOptimizerPerformanceBucket[]
  setupComboPerformance: SPXOptimizerPerformanceBucket[]
  setupActions: {
    add: string[]
    update: string[]
    remove: string[]
  }
  blockerMix: {
    totalOpportunityCount: number
    macroBlockedCount: number
    microBlockedCount: number
    macroBlockedPct: number
    microBlockedPct: number
    baselineTriggerRatePct: number
    optimizedTriggerRatePct: number
    triggerRateDeltaPct: number
    triggerRateGuardrailPassed: boolean
    bySetupRegimeTimeBucket: Array<{
      key: string
      totalOpportunityCount: number
      macroBlockedCount: number
      microBlockedCount: number
      macroBlockedPct: number
      microBlockedPct: number
      blockedPct: number
    }>
  }
  optimizationApplied: boolean
  governance?: SPXPromotionGovernance
  dataQuality?: SPXOptimizerDataQuality
  notes: string[]
}

export interface SPXOptimizerScheduleStatus {
  enabled: boolean
  isRunning: boolean
  mode: 'nightly_auto'
  timezone: 'America/New_York'
  targetMinuteEt: number
  targetTimeEt: string
  checkIntervalMs: number
  lastRunDateEt: string | null
  lastAttemptAt: string | null
  lastAttemptAtEt: string | null
  lastSuccessAt: string | null
  lastSuccessAtEt: string | null
  lastErrorMessage: string | null
  nextEligibleRunDateEt: string | null
  nextEligibleRunAtEt: string | null
  lastOptimizationGeneratedAt: string | null
  lastOptimizationRange: { from: string; to: string } | null
  lastOptimizationApplied: boolean | null
}

export interface SPXOptimizerHistoryEntry {
  id: number
  createdAt: string
  mode: 'manual' | 'weekly_auto' | 'nightly_auto' | 'revert'
  action: 'scan' | 'revert'
  optimizationApplied: boolean
  actor: string | null
  reason: string | null
  revertedFromHistoryId: number | null
  scanRange: { from: string | null; to: string | null }
  trainingRange: { from: string | null; to: string | null }
  validationRange: { from: string | null; to: string | null }
  previousProfileGeneratedAt: string | null
  nextProfileGeneratedAt: string | null
  scorecardSummary: {
    baselineTrades: number
    optimizedTrades: number
    t1Delta: number
    t2Delta: number
    expectancyDeltaR: number
    objectiveConservativeDelta: number
    optimizationApplied: boolean
  } | null
  notes: string[]
}

interface SPXOptimizerScanResponse {
  profile: Record<string, unknown>
  scorecard: SPXOptimizerScorecard
}

interface SPXOptimizerHistoryResponse {
  history: SPXOptimizerHistoryEntry[]
  count: number
}

interface SPXOptimizerRevertResponse {
  profile: Record<string, unknown>
  scorecard: SPXOptimizerScorecard
  revertedFromHistoryId: number
  historyEntryId: number | null
  message: string
}

export interface SPXWinRateBacktestAnalytics {
  dateRange: { from: string; to: string }
  triggeredCount: number
  resolvedCount: number
  t1Wins: number
  t2Wins: number
  stopsBeforeT1: number
  t1WinRatePct: number
  t2WinRatePct: number
  failureRatePct: number
}

export interface SPXWinRateBacktestSnapshot {
  dateRange: { from: string; to: string }
  sourceUsed: 'spx_setup_instances' | 'none'
  setupCount: number
  evaluatedSetupCount: number
  skippedSetupCount: number
  resolutionUsed: 'minute' | 'second' | 'none'
  profitability: {
    triggeredCount: number
    resolvedCount: number
    withRealizedRCount: number
    averageRealizedR: number
    medianRealizedR: number
    cumulativeRealizedR: number
    expectancyR: number
    positiveRealizedRatePct: number
  }
  analytics: SPXWinRateBacktestAnalytics
  notes: string[]
}

const OPTIMIZER_SCORECARD_BASE_REFRESH_MS = 30_000
const OPTIMIZER_SCHEDULE_BASE_REFRESH_MS = 30_000
const OPTIMIZER_HISTORY_BASE_REFRESH_MS = 45_000
const OPTIMIZER_BACKTEST_BASE_REFRESH_MS = 180_000
const OPTIMIZER_MAX_BACKOFF_MS = 10 * 60 * 1000
const OPTIMIZER_MISSING_ENDPOINT_BACKOFF_MS = 20 * 60 * 1000

type OptimizerEndpointKey = 'scorecard' | 'schedule' | 'history' | 'backtest'
type OptimizerFailureState = Record<OptimizerEndpointKey, {
  consecutiveFailures: number
  cooldownUntilMs: number
}>

const optimizerFailureState: OptimizerFailureState = {
  scorecard: { consecutiveFailures: 0, cooldownUntilMs: 0 },
  schedule: { consecutiveFailures: 0, cooldownUntilMs: 0 },
  history: { consecutiveFailures: 0, cooldownUntilMs: 0 },
  backtest: { consecutiveFailures: 0, cooldownUntilMs: 0 },
}

function markOptimizerFailure(key: OptimizerEndpointKey, error: Error): void {
  const state = optimizerFailureState[key]
  if (error instanceof SPXRequestError && (error.status === 404 || error.status === 405)) {
    state.consecutiveFailures = 0
    state.cooldownUntilMs = Date.now() + OPTIMIZER_MISSING_ENDPOINT_BACKOFF_MS
    return
  }

  state.consecutiveFailures = Math.min(state.consecutiveFailures + 1, 6)
  const delay = Math.min(
    OPTIMIZER_SCORECARD_BASE_REFRESH_MS * (2 ** Math.max(state.consecutiveFailures - 1, 0)),
    OPTIMIZER_MAX_BACKOFF_MS,
  )
  state.cooldownUntilMs = Date.now() + delay
}

function clearOptimizerFailureState(key: OptimizerEndpointKey): void {
  optimizerFailureState[key].consecutiveFailures = 0
  optimizerFailureState[key].cooldownUntilMs = 0
}

function getOptimizerRefreshInterval(key: OptimizerEndpointKey, baseMs: number): number {
  const state = optimizerFailureState[key]
  const now = Date.now()
  if (state.cooldownUntilMs > now) {
    return Math.max(state.cooldownUntilMs - now, baseMs)
  }
  return baseMs
}

function getYearStartDateEt(now: Date = new Date()): string {
  const etYear = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
  }).format(now)
  return `${etYear}-01-01`
}

export function useSPXOptimizer() {
  const { session } = useMemberAuth()
  const [scanError, setScanError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [revertError, setRevertError] = useState<string | null>(null)
  const [isReverting, setIsReverting] = useState(false)
  const ytdFromEt = useMemo(() => getYearStartDateEt(), [])

  const scorecardQuery = useSPXQuery<SPXOptimizerScorecard>('/api/spx/analytics/optimizer/scorecard', {
    refreshInterval: () => getOptimizerRefreshInterval('scorecard', OPTIMIZER_SCORECARD_BASE_REFRESH_MS),
    revalidateOnFocus: false,
    errorRetryCount: 0,
    onError: (error) => markOptimizerFailure('scorecard', error),
    onSuccess: () => clearOptimizerFailureState('scorecard'),
  })
  const scheduleQuery = useSPXQuery<SPXOptimizerScheduleStatus>('/api/spx/analytics/optimizer/schedule', {
    refreshInterval: () => getOptimizerRefreshInterval('schedule', OPTIMIZER_SCHEDULE_BASE_REFRESH_MS),
    revalidateOnFocus: false,
    errorRetryCount: 0,
    onError: (error) => markOptimizerFailure('schedule', error),
    onSuccess: () => clearOptimizerFailureState('schedule'),
  })
  const historyQuery = useSPXQuery<SPXOptimizerHistoryResponse>('/api/spx/analytics/optimizer/history?limit=20', {
    refreshInterval: () => getOptimizerRefreshInterval('history', OPTIMIZER_HISTORY_BASE_REFRESH_MS),
    revalidateOnFocus: false,
    errorRetryCount: 0,
    onError: (error) => markOptimizerFailure('history', error),
    onSuccess: () => clearOptimizerFailureState('history'),
  })
  const ytdBacktestQuery = useSPXQuery<SPXWinRateBacktestSnapshot>(
    `/api/spx/analytics/win-rate/backtest?source=spx_setup_instances&resolution=second&from=${ytdFromEt}`,
    {
      refreshInterval: () => getOptimizerRefreshInterval('backtest', OPTIMIZER_BACKTEST_BASE_REFRESH_MS),
      revalidateOnFocus: false,
      errorRetryCount: 0,
      onError: (error) => markOptimizerFailure('backtest', error),
      onSuccess: () => clearOptimizerFailureState('backtest'),
    },
  )

  const runScan = useCallback(async () => {
    const token = session?.access_token
    if (!token) {
      throw new Error('Session unavailable')
    }

    setIsScanning(true)
    setScanError(null)
    try {
      const response = await postSPX<SPXOptimizerScanResponse>('/api/spx/analytics/optimizer/scan', token, {})
      await scorecardQuery.mutate(response.scorecard, { revalidate: false })
      await scheduleQuery.mutate()
      await historyQuery.mutate()
      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Optimizer scan failed'
      setScanError(message)
      throw error
    } finally {
      setIsScanning(false)
    }
  }, [historyQuery, scheduleQuery, scorecardQuery, session?.access_token])

  const revertToHistory = useCallback(async (historyId: number, reason?: string) => {
    const token = session?.access_token
    if (!token) {
      throw new Error('Session unavailable')
    }

    setIsReverting(true)
    setRevertError(null)
    try {
      const response = await postSPX<SPXOptimizerRevertResponse>('/api/spx/analytics/optimizer/revert', token, {
        historyId,
        reason,
      })
      await scorecardQuery.mutate(response.scorecard, { revalidate: false })
      await Promise.all([
        scheduleQuery.mutate(),
        historyQuery.mutate(),
      ])
      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Optimizer revert failed'
      setRevertError(message)
      throw error
    } finally {
      setIsReverting(false)
    }
  }, [historyQuery, scheduleQuery, scorecardQuery, session?.access_token])

  return {
    scorecard: scorecardQuery.data || null,
    schedule: scheduleQuery.data || null,
    history: historyQuery.data?.history || [],
    ytdBacktest: ytdBacktestQuery.data || null,
    ytdFromEt,
    isLoading: scorecardQuery.isLoading,
    isScheduleLoading: scheduleQuery.isLoading,
    isHistoryLoading: historyQuery.isLoading,
    isBacktestLoading: ytdBacktestQuery.isLoading,
    error: scorecardQuery.error,
    scheduleError: scheduleQuery.error,
    historyError: historyQuery.error,
    backtestError: ytdBacktestQuery.error,
    isScanning,
    scanError,
    isReverting,
    revertError,
    runScan,
    revertToHistory,
    refresh: scorecardQuery.mutate,
    refreshSchedule: scheduleQuery.mutate,
    refreshHistory: historyQuery.mutate,
    refreshBacktest: ytdBacktestQuery.mutate,
  }
}
