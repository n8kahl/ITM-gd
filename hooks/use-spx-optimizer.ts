'use client'

import { useCallback, useState } from 'react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { postSPX, useSPXQuery } from '@/hooks/use-spx-api'

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
  sourceUsed: 'spx_setup_instances' | 'ai_coach_tracked_setups' | 'none' | 'unknown'
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
  executionTradesWithEntryFill: number
  executionTradesWithExitFill: number
  executionTradesWithNonProxyFill: number
  executionCoveragePct: number
  executionEntryCoveragePct: number
  executionExitCoveragePct: number
  executionNonProxyCoveragePct: number
  executionEntryAvgSlippagePts: number | null
  executionExitAvgSlippagePts: number | null
  executionEntryAvgSlippageBps: number | null
  executionExitAvgSlippageBps: number | null
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

export function useSPXOptimizer() {
  const { session } = useMemberAuth()
  const [scanError, setScanError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [revertError, setRevertError] = useState<string | null>(null)
  const [isReverting, setIsReverting] = useState(false)

  const scorecardQuery = useSPXQuery<SPXOptimizerScorecard>('/api/spx/analytics/optimizer/scorecard', {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  })
  const scheduleQuery = useSPXQuery<SPXOptimizerScheduleStatus>('/api/spx/analytics/optimizer/schedule', {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  })
  const historyQuery = useSPXQuery<SPXOptimizerHistoryResponse>('/api/spx/analytics/optimizer/history?limit=20', {
    refreshInterval: 45_000,
    revalidateOnFocus: false,
  })

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
    isLoading: scorecardQuery.isLoading,
    isScheduleLoading: scheduleQuery.isLoading,
    isHistoryLoading: historyQuery.isLoading,
    error: scorecardQuery.error,
    scheduleError: scheduleQuery.error,
    historyError: historyQuery.error,
    isScanning,
    scanError,
    isReverting,
    revertError,
    runScan,
    revertToHistory,
    refresh: scorecardQuery.mutate,
    refreshSchedule: scheduleQuery.mutate,
    refreshHistory: historyQuery.mutate,
  }
}
