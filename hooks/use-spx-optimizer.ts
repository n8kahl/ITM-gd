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
  optimizationApplied: boolean
  notes: string[]
}

interface SPXOptimizerScanResponse {
  profile: Record<string, unknown>
  scorecard: SPXOptimizerScorecard
}

export function useSPXOptimizer() {
  const { session } = useMemberAuth()
  const [scanError, setScanError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  const scorecardQuery = useSPXQuery<SPXOptimizerScorecard>('/api/spx/analytics/optimizer/scorecard', {
    refreshInterval: 30_000,
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
      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Optimizer scan failed'
      setScanError(message)
      throw error
    } finally {
      setIsScanning(false)
    }
  }, [scorecardQuery, session?.access_token])

  return {
    scorecard: scorecardQuery.data || null,
    isLoading: scorecardQuery.isLoading,
    error: scorecardQuery.error,
    isScanning,
    scanError,
    runScan,
    refresh: scorecardQuery.mutate,
  }
}
