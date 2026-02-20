'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mergeRealtimeMicrobarIntoBars, mergeRealtimePriceIntoBars } from '@/components/ai-coach/chart-realtime'
import { TradingChart, type LevelAnnotation } from '@/components/ai-coach/trading-chart'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { getChartData, type ChartBar } from '@/lib/api/ai-coach'
import { arraysEqual, stabilizeLevelKeys } from '@/lib/spx/level-stability'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import type { SPXLevel } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'

const PRICE_COMMIT_THROTTLE_MS = 300
const PRICE_COMMIT_REPORT_MS = 30_000
const FOCUSED_LEVEL_REFRESH_MS = 1_000
const FOCUSED_LEVEL_MIN_PROMOTE_STREAK = 2
const LEVEL_CHURN_WINDOW_MS = 60_000

function toLineStyle(style: 'solid' | 'dashed' | 'dotted' | 'dot-dash'): 'solid' | 'dashed' | 'dotted' {
  if (style === 'dot-dash') return 'dashed'
  return style
}

function isSpyDerivedLevel(level: SPXLevel): boolean {
  return level.category === 'spy_derived'
    || level.symbol === 'SPY'
    || level.source.startsWith('spy_')
}

function isVWAPLevel(level: SPXLevel): boolean {
  return /(^|_)vwap($|_)/i.test(level.source) || level.source.toUpperCase() === 'VWAP'
}

function labelFromSource(source: string): string {
  const normalized = source.toLowerCase()
  if (normalized === 'vwap' || normalized.endsWith('_vwap') || normalized.includes('vwap')) return 'VWAP'
  if (normalized.includes('call_wall')) return 'Call Wall'
  if (normalized.includes('put_wall')) return 'Put Wall'
  if (normalized.includes('flip_point')) return 'Flip'
  if (normalized.includes('zero_gamma')) return 'Zero Gamma'
  if (normalized.startsWith('fib_')) return source.replace(/^fib_/, '').replace(/_/g, ' ').toUpperCase()
  return source.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function chartLevelLabel(level: SPXLevel): string {
  const base = labelFromSource(level.source)
  if (isSpyDerivedLevel(level)) return `SPY→SPX ${base}`
  if (level.category === 'options') return `Options ${base}`
  return base
}

interface SPXChartProps {
  showAllRelevantLevels: boolean
  mobileExpanded?: boolean
  futureOffsetBars?: number
  className?: string
  onDisplayedLevelsChange?: (displayed: number, total: number) => void
  onChartReady?: (chart: IChartApi, series: ISeriesApi<'Candlestick'>) => void
  onLatestBarTimeChange?: (timeSec: number | null) => void
}

export function SPXChart({
  showAllRelevantLevels,
  mobileExpanded = false,
  futureOffsetBars,
  className,
  onDisplayedLevelsChange,
  onChartReady,
  onLatestBarTimeChange,
}: SPXChartProps) {
  const { session } = useMemberAuth()
  const { levels } = useSPXAnalyticsContext()
  const { selectedSetup, chartAnnotations } = useSPXSetupContext()
  const {
    spxPrice,
    spxTickTimestamp,
    spxPriceAgeMs,
    spxPriceSource,
    latestMicrobar,
    selectedTimeframe,
    setChartTimeframe,
  } = useSPXPriceContext()

  const [bars, setBars] = useState<ChartBar[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stableFocusedLevelKeys, setStableFocusedLevelKeys] = useState<string[]>([])
  const pendingPriceUpdateRef = useRef<{
    price: number
    timestampIso: string
    maxAgeMs: number
    receivedAtEpochMs: number
  } | null>(null)
  const latestFocusedCandidatesRef = useRef<LevelAnnotation[]>([])
  const focusedLevelStreakByKeyRef = useRef<Record<string, number>>({})
  const levelMutationEpochsRef = useRef<number[]>([])
  const lastLevelMutationEpochRef = useRef<number | null>(null)
  const lastLabelLayoutSignatureRef = useRef<string | null>(null)
  const priceCommitStatsRef = useRef({
    enqueued: 0,
    committed: 0,
    noChange: 0,
    staleDropped: 0,
  })

  useEffect(() => {
    // Always reset to 1m on page entry for command-center first-action consistency.
    setChartTimeframe('1m')
  }, [setChartTimeframe])

  useEffect(() => {
    let isCancelled = false
    let inFlight = false

    async function load(options?: { background?: boolean }) {
      if (inFlight) return
      inFlight = true
      if (!session?.access_token) {
        setBars([])
        setIsLoading(false)
        inFlight = false
        return
      }

      const background = options?.background === true
      if (!background) {
        setIsLoading(true)
      }

      try {
        const response = await getChartData('SPX', selectedTimeframe, session.access_token)
        if (!isCancelled) {
          if (Array.isArray(response.bars) && response.bars.length > 0) {
            setBars(response.bars)
          } else if (!background) {
            setBars([])
          }
        }
      } catch {
        if (!isCancelled && !background) {
          setBars([])
        }
      } finally {
        if (!isCancelled) {
          if (!background) {
            setIsLoading(false)
          }
        }
        inFlight = false
      }
    }

    if (!session?.access_token) {
      setBars([])
      setIsLoading(false)
      return () => {
        isCancelled = true
      }
    }

    void load()
    const refreshIntervalMs = selectedTimeframe === '1m' ? 30_000 : 60_000
    const refreshId = window.setInterval(() => {
      void load({ background: true })
    }, refreshIntervalMs)

    return () => {
      isCancelled = true
      window.clearInterval(refreshId)
    }
  }, [selectedTimeframe, session?.access_token])

  useEffect(() => {
    if (!latestMicrobar || selectedTimeframe !== '1m') return

    setBars((prev) => {
      const merged = mergeRealtimeMicrobarIntoBars(prev, selectedTimeframe, latestMicrobar)
      return merged.changed ? merged.bars : prev
    })
  }, [latestMicrobar, selectedTimeframe])

  useEffect(() => {
    if (!spxTickTimestamp || !Number.isFinite(spxPrice) || spxPrice <= 0) return
    const maxAgeMs = spxPriceSource === 'tick' ? 10_000 : 90_000
    if (spxPriceAgeMs != null && spxPriceAgeMs > maxAgeMs) return

    pendingPriceUpdateRef.current = {
      price: spxPrice,
      timestampIso: spxTickTimestamp,
      maxAgeMs,
      receivedAtEpochMs: Date.now(),
    }
    priceCommitStatsRef.current.enqueued += 1
  }, [spxPrice, spxPriceAgeMs, spxPriceSource, spxTickTimestamp])

  const flushPriceCommitStats = useCallback((reason: 'interval' | 'teardown') => {
    const stats = priceCommitStatsRef.current
    const total = stats.committed + stats.noChange + stats.staleDropped
    if (total === 0) return

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CHART_PRICE_COMMIT, {
      reason,
      timeframe: selectedTimeframe,
      throttleMs: PRICE_COMMIT_THROTTLE_MS,
      enqueued: stats.enqueued,
      committed: stats.committed,
      noChange: stats.noChange,
      staleDropped: stats.staleDropped,
      commitRatio: Number((stats.committed / Math.max(total, 1)).toFixed(3)),
    })

    priceCommitStatsRef.current = {
      enqueued: 0,
      committed: 0,
      noChange: 0,
      staleDropped: 0,
    }
  }, [selectedTimeframe])

  const flushPendingPriceUpdate = useCallback(() => {
    const pending = pendingPriceUpdateRef.current
    if (!pending) return

    if ((Date.now() - pending.receivedAtEpochMs) > pending.maxAgeMs) {
      priceCommitStatsRef.current.staleDropped += 1
      pendingPriceUpdateRef.current = null
      return
    }

    let changed = false
    setBars((prev) => {
      const merged = mergeRealtimePriceIntoBars(prev, selectedTimeframe, pending.price, pending.timestampIso)
      changed = merged.changed
      return merged.changed ? merged.bars : prev
    })
    if (changed) {
      priceCommitStatsRef.current.committed += 1
    } else {
      priceCommitStatsRef.current.noChange += 1
    }
    pendingPriceUpdateRef.current = null
  }, [selectedTimeframe])

  useEffect(() => {
    flushPendingPriceUpdate()
    const intervalId = window.setInterval(() => {
      flushPendingPriceUpdate()
    }, PRICE_COMMIT_THROTTLE_MS)

    const reportId = window.setInterval(() => {
      flushPriceCommitStats('interval')
    }, PRICE_COMMIT_REPORT_MS)

    return () => {
      window.clearInterval(intervalId)
      window.clearInterval(reportId)
      flushPriceCommitStats('teardown')
    }
  }, [flushPendingPriceUpdate, flushPriceCommitStats])

  const levelAnnotations = useMemo<LevelAnnotation[]>(() => {
    return levels.map((level) => ({
      ...(isVWAPLevel(level)
        ? {
          label: 'VWAP',
          color: 'rgba(234, 179, 8, 0.88)',
          lineStyle: 'dashed' as const,
          lineWidth: Math.max(2, level.chartStyle.lineWidth),
          type: 'vwap',
        }
        : {
          label: chartLevelLabel(level),
          color: isSpyDerivedLevel(level) ? 'rgba(245, 237, 204, 0.72)' : level.chartStyle.color,
          lineStyle: toLineStyle(isSpyDerivedLevel(level) ? 'dot-dash' : level.chartStyle.lineStyle),
          lineWidth: level.chartStyle.lineWidth,
          type: level.category,
        }),
      price: level.price,
      axisLabelVisible: true,
      strength: level.strength,
      description: typeof level.metadata.description === 'string'
        ? level.metadata.description
        : `${chartLevelLabel(level)}${isSpyDerivedLevel(level) ? ' (SPY impact projection)' : ''}`,
      testsToday: typeof level.metadata.testsToday === 'number' ? level.metadata.testsToday : undefined,
      lastTest: typeof level.metadata.lastTestAt === 'string' ? level.metadata.lastTestAt : null,
      holdRate: typeof level.metadata.holdRate === 'number' ? level.metadata.holdRate : null,
      displayContext: typeof level.metadata.displayContext === 'string' ? level.metadata.displayContext : undefined,
    }))
  }, [levels])

  const targetFocusedLevelCount = selectedSetup ? 8 : 6

  const focusedLevelCandidates = useMemo<LevelAnnotation[]>(() => {
    if (levelAnnotations.length === 0) return []
    const livePrice = bars[bars.length - 1]?.close || (spxPrice > 0 ? spxPrice : null)

    const strengthWeight = (strength?: string) => {
      if (strength === 'critical') return 1.5
      if (strength === 'strong') return 1.35
      if (strength === 'moderate') return 1.15
      return 1
    }

    const typeWeight = (type?: string) => {
      if (!type) return 1
      if (type === 'options') return 1.2
      if (type === 'structural') return 1.15
      if (type === 'fibonacci') return 0.95
      return 1
    }

    const ranked = [...levelAnnotations]
      .map((annotation) => {
        const distance = livePrice == null ? 0 : Math.abs(annotation.price - livePrice)
        const score = distance / (strengthWeight(annotation.strength) * typeWeight(annotation.type))
        return { annotation, score }
      })
      .sort((a, b) => a.score - b.score)

    const baseFocused = ranked.slice(0, targetFocusedLevelCount).map((item) => item.annotation)
    const nearestSpyDerived = ranked
      .filter((item) => item.annotation.type === 'spy_derived')
      .slice(0, 2)
      .map((item) => item.annotation)
    const vwapLevel = ranked
      .find((item) => item.annotation.type === 'vwap')
      ?.annotation

    const merged = new Map<string, LevelAnnotation>()
    for (const annotation of [...baseFocused, ...nearestSpyDerived, ...(vwapLevel ? [vwapLevel] : [])]) {
      const key = `${annotation.label}:${annotation.price}:${annotation.type || 'unknown'}`
      if (!merged.has(key)) merged.set(key, annotation)
    }

    return Array.from(merged.values())
  }, [bars, levelAnnotations, spxPrice, targetFocusedLevelCount])

  const toLevelKey = useCallback((annotation: LevelAnnotation): string => (
    `${annotation.label}:${annotation.price}:${annotation.type || 'unknown'}`
  ), [])

  useEffect(() => {
    latestFocusedCandidatesRef.current = focusedLevelCandidates
  }, [focusedLevelCandidates])

  const refreshStableFocusedLevels = useCallback(() => {
    const candidates = latestFocusedCandidatesRef.current
    const candidateKeys = candidates.map(toLevelKey)

    const next = stabilizeLevelKeys({
      previousStableKeys: stableFocusedLevelKeys,
      previousStreakByKey: focusedLevelStreakByKeyRef.current,
      candidateKeys,
      targetCount: targetFocusedLevelCount,
      minPromoteStreak: FOCUSED_LEVEL_MIN_PROMOTE_STREAK,
    })

    focusedLevelStreakByKeyRef.current = next.streakByKey
    if (!arraysEqual(next.stableKeys, stableFocusedLevelKeys)) {
      const nowEpochMs = Date.now()
      const previousStableSet = new Set(stableFocusedLevelKeys)
      const nextStableSet = new Set(next.stableKeys)
      const added = next.stableKeys.filter((key) => !previousStableSet.has(key)).length
      const removed = stableFocusedLevelKeys.filter((key) => !nextStableSet.has(key)).length
      const windowEpochs = levelMutationEpochsRef.current
        .filter((epoch) => (nowEpochMs - epoch) <= LEVEL_CHURN_WINDOW_MS)
      windowEpochs.push(nowEpochMs)
      levelMutationEpochsRef.current = windowEpochs

      const previousMutationEpoch = lastLevelMutationEpochRef.current
      lastLevelMutationEpochRef.current = nowEpochMs

      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CHART_LEVEL_SET_CHANGED, {
        timeframe: selectedTimeframe,
        refreshMs: FOCUSED_LEVEL_REFRESH_MS,
        minPromoteStreak: FOCUSED_LEVEL_MIN_PROMOTE_STREAK,
        shownCount: next.stableKeys.length,
        candidateCount: candidateKeys.length,
        added,
        removed,
        churnPerMinute: windowEpochs.length,
        secondsSincePreviousMutation: previousMutationEpoch == null
          ? null
          : Number(((nowEpochMs - previousMutationEpoch) / 1000).toFixed(2)),
      })

      setStableFocusedLevelKeys(next.stableKeys)
    }
  }, [stableFocusedLevelKeys, targetFocusedLevelCount, toLevelKey, selectedTimeframe])

  useEffect(() => {
    refreshStableFocusedLevels()
    const intervalId = window.setInterval(() => {
      refreshStableFocusedLevels()
    }, FOCUSED_LEVEL_REFRESH_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [refreshStableFocusedLevels])

  const focusedLevelAnnotations = useMemo<LevelAnnotation[]>(() => {
    if (focusedLevelCandidates.length === 0) return []
    if (stableFocusedLevelKeys.length === 0) return focusedLevelCandidates.slice(0, targetFocusedLevelCount)

    const candidateByKey = new Map(
      focusedLevelCandidates.map((annotation) => [toLevelKey(annotation), annotation] as const),
    )
    const resolved = stableFocusedLevelKeys
      .map((key) => candidateByKey.get(key) || null)
      .filter((annotation): annotation is LevelAnnotation => annotation != null)

    if (resolved.length >= targetFocusedLevelCount) {
      return resolved.slice(0, targetFocusedLevelCount)
    }

    const merged = [...resolved]
    for (const annotation of focusedLevelCandidates) {
      const key = toLevelKey(annotation)
      if (stableFocusedLevelKeys.includes(key)) continue
      merged.push(annotation)
      if (merged.length >= targetFocusedLevelCount) break
    }

    return merged
  }, [focusedLevelCandidates, stableFocusedLevelKeys, targetFocusedLevelCount, toLevelKey])

  const setupAnnotations = useMemo<LevelAnnotation[]>(() => {
    if (!selectedSetup) return []

    return chartAnnotations.reduce<LevelAnnotation[]>((acc, annotation) => {
      if (annotation.type === 'entry_zone' && annotation.priceLow != null && annotation.priceHigh != null) {
        acc.push(
          {
            price: annotation.priceLow,
            label: `${annotation.label} Low`,
            color: 'rgba(16,185,129,0.75)',
            lineStyle: 'dashed',
            lineWidth: 1,
            axisLabelVisible: true,
            type: annotation.type,
          },
          {
            price: annotation.priceHigh,
            label: `${annotation.label} High`,
            color: 'rgba(16,185,129,0.75)',
            lineStyle: 'dashed',
            lineWidth: 1,
            axisLabelVisible: true,
            type: annotation.type,
          },
        )
        return acc
      }

      if (annotation.price != null) {
        acc.push({
          price: annotation.price,
          label: annotation.label,
          color: annotation.type === 'stop' ? 'rgba(251,113,133,0.75)' : 'rgba(244,208,120,0.75)',
          lineStyle: 'solid',
          lineWidth: 1.5,
          axisLabelVisible: true,
          type: annotation.type,
        })
      }

      return acc
    }, [])
  }, [chartAnnotations, selectedSetup])

  const displayedLevels = showAllRelevantLevels ? levelAnnotations : focusedLevelAnnotations

  useEffect(() => {
    onDisplayedLevelsChange?.(displayedLevels.length, levelAnnotations.length)
  }, [displayedLevels.length, levelAnnotations.length, onDisplayedLevelsChange])

  useEffect(() => {
    if (!onLatestBarTimeChange) return
    const latestBar = bars[bars.length - 1]
    onLatestBarTimeChange(latestBar && Number.isFinite(latestBar.time) ? latestBar.time : null)
  }, [bars, onLatestBarTimeChange])

  const handleLevelLayoutStats = useCallback((stats: {
    inputCount: number
    dedupedCount: number
    budgetSuppressedCount: number
    collisionSuppressedCount: number
  }) => {
    const signature = [
      stats.inputCount,
      stats.dedupedCount,
      stats.budgetSuppressedCount,
      stats.collisionSuppressedCount,
      selectedTimeframe,
    ].join(':')

    if (signature === lastLabelLayoutSignatureRef.current) return
    lastLabelLayoutSignatureRef.current = signature

    if (stats.dedupedCount <= 0 && stats.budgetSuppressedCount <= 0 && stats.collisionSuppressedCount <= 0) {
      return
    }

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CHART_LABEL_COLLISION, {
      surface: 'trading_chart_axis_labels',
      timeframe: selectedTimeframe,
      inputCount: stats.inputCount,
      dedupedCount: stats.dedupedCount,
      budgetSuppressedCount: stats.budgetSuppressedCount,
      collisionSuppressedCount: stats.collisionSuppressedCount,
      focusedMode: !showAllRelevantLevels,
    })
  }, [selectedTimeframe, showAllRelevantLevels])

  return (
    <section className={cn('relative h-full w-full', className)}>
      <div className="pointer-events-none absolute left-2 top-2 z-[2]">
        <h3 className="rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/65">
          Price + Levels
        </h3>
      </div>
      <div className={cn(mobileExpanded ? 'h-[55vh] min-h-[320px] max-h-[500px]' : 'h-full')}>
        <TradingChart
          symbol="SPX"
          timeframe={selectedTimeframe}
          bars={bars}
          levels={[...displayedLevels, ...setupAnnotations]}
          futureOffsetBars={futureOffsetBars}
          isLoading={isLoading}
          onChartReady={onChartReady}
          onLevelLayoutStats={handleLevelLayoutStats}
        />
      </div>
    </section>
  )
}
