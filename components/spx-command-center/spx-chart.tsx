'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mergeRealtimeMicrobarIntoBars, mergeRealtimePriceIntoBars } from '@/components/ai-coach/chart-realtime'
import {
  TradingChart,
  type ChartEventMarker,
  type LevelAnnotation,
  type TradingChartCrosshairSnapshot,
} from '@/components/ai-coach/trading-chart'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { getChartData, type ChartBar } from '@/lib/api/ai-coach'
import { arraysEqual, stabilizeLevelKeys } from '@/lib/spx/level-stability'
import {
  createSPXReplayEngine,
  getSPXReplayIntervalMs,
  type SPXReplaySpeed,
  type SPXReplayWindowMinutes,
} from '@/lib/spx/replay-engine'
import { buildSPXScenarioLanes } from '@/lib/spx/scenario-lanes'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import type { SPXLevelVisibilityBudget } from '@/lib/spx/overlay-priority'
import type { ReplayAnalyticalSnapshot } from '@/lib/trade-day-replay/types'
import {
  publishReplayCursorTime,
  publishReplayTranscriptJump,
  subscribeReplaySessionSync,
  type ReplaySessionSyncMessage,
  type ReplaySessionSyncPayload,
  type ReplaySessionSyncTrade,
} from '@/lib/spx/replay-session-sync'
import type { SPXLevel } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'

const PRICE_COMMIT_THROTTLE_MS = 300
const PRICE_COMMIT_REPORT_MS = 30_000
const FOCUSED_LEVEL_REFRESH_MS = 1_000
const FOCUSED_LEVEL_MIN_PROMOTE_STREAK = 2
const LEVEL_CHURN_WINDOW_MS = 60_000
const CHART_TOOLTIP_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/New_York',
})

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
  if (normalized === 'opening_range_high') return 'OR-High'
  if (normalized === 'opening_range_low') return 'OR-Low'
  if (normalized.startsWith('fib_')) return source.replace(/^fib_/, '').replace(/_/g, ' ').toUpperCase()
  return source.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function chartLevelLabel(level: SPXLevel, compact = false): string {
  const base = labelFromSource(level.source)
  if (compact) {
    // Abbreviated labels for mobile — prevent overlap on narrow viewports (Audit #9 CRITICAL-3)
    if (isSpyDerivedLevel(level)) return `S→${base}`
    if (level.category === 'options') return base
    return base
  }
  if (isSpyDerivedLevel(level)) return `SPY→SPX ${base}`
  if (level.category === 'options') return `Options ${base}`
  return base
}

type ReplayMarkerKind = 'entry' | 'exit' | 'trim' | 'stop_adjust' | 'trail' | 'breakeven' | 'thesis'

function toEpochSeconds(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return Math.floor(parsed / 1000)
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeLifecycleMarkerKind(value: string | null | undefined): ReplayMarkerKind | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_')
  if (normalized.includes('trim')) return 'trim'
  if (
    normalized === 'stop'
    || normalized === 'stops'
    || normalized.includes('stop_adjust')
  ) {
    return 'stop_adjust'
  }
  if (normalized.includes('trail')) return 'trail'
  if (normalized.includes('breakeven') || normalized === 'b/e') return 'breakeven'
  if (normalized.includes('exit') || normalized.includes('fully_out') || normalized.includes('fully_sold')) return 'exit'
  return null
}

function lifecycleMarkerLabel(kind: ReplayMarkerKind, tradeIndex: number, value: number | null): string {
  if (kind === 'trim') {
    const pct = value != null ? `${Math.round(value)}%` : '--'
    return `Trim #${tradeIndex} ${pct}`
  }
  if (kind === 'stop_adjust') return `Stop Adj #${tradeIndex}`
  if (kind === 'trail') return `Trail #${tradeIndex}`
  if (kind === 'breakeven') return `B/E #${tradeIndex}`
  if (kind === 'exit') return `Exit #${tradeIndex}`
  return `Thesis #${tradeIndex}`
}

function isReplayThesisMessage(message: ReplaySessionSyncMessage): boolean {
  const signal = String(message.signalType || '').trim().toLowerCase()
  if (signal.includes('thesis')) return true
  const content = String(message.content || '').trim()
  if (content.length < 20) return false
  return /\b(thesis|plan|reason|because|looking for|entry condition|if .* then)\b/i.test(content)
}

function markerImpactForKind(kind: ReplayMarkerKind): ChartEventMarker['impact'] {
  if (kind === 'entry') return 'low'
  if (kind === 'trim') return 'medium'
  if (kind === 'stop_adjust' || kind === 'trail' || kind === 'breakeven') return 'medium'
  if (kind === 'exit') return 'high'
  return 'info'
}

interface SPXChartProps {
  showAllRelevantLevels: boolean
  renderLevelAnnotations?: boolean
  countReportingMode?: 'enabled' | 'disabled'
  mobileExpanded?: boolean
  futureOffsetBars?: number
  className?: string
  focusMode?: 'decision' | 'execution' | 'risk_only'
  replayEnabled?: boolean
  replayPlaying?: boolean
  replayWindowMinutes?: SPXReplayWindowMinutes
  replaySpeed?: SPXReplaySpeed
  replaySnapshots?: ReplayAnalyticalSnapshot[]
  levelVisibilityBudget?: SPXLevelVisibilityBudget
  onDisplayedLevelsChange?: (displayed: number, total: number) => void
  onChartReady?: (chart: IChartApi, series: ISeriesApi<'Candlestick'>) => void
  onLatestBarTimeChange?: (timeSec: number | null) => void
}

export function SPXChart({
  showAllRelevantLevels,
  renderLevelAnnotations = true,
  countReportingMode = 'enabled',
  mobileExpanded = false,
  futureOffsetBars,
  className,
  focusMode = 'decision',
  replayEnabled = false,
  replayPlaying = false,
  replayWindowMinutes = 60,
  replaySpeed = 1,
  replaySnapshots,
  levelVisibilityBudget,
  onDisplayedLevelsChange,
  onChartReady,
  onLatestBarTimeChange,
}: SPXChartProps) {
  const { session } = useMemberAuth()
  const { levels } = useSPXAnalyticsContext()
  const { selectedSetup, chartAnnotations, tradeMode } = useSPXSetupContext()
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
  const [crosshairSnapshot, setCrosshairSnapshot] = useState<TradingChartCrosshairSnapshot | null>(null)
  const [touchHoldActive, setTouchHoldActive] = useState(false)
  const [replayCursorIndex, setReplayCursorIndex] = useState<number | null>(null)
  const [selectedReplaySession, setSelectedReplaySession] = useState<ReplaySessionSyncPayload | null>(null)
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
  const lastTooltipVisibilityRef = useRef<boolean | null>(null)
  const lastReplayProgressBucketRef = useRef<number | null>(null)
  const lastScenarioSignatureRef = useRef<string | null>(null)
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
    return subscribeReplaySessionSync((payload) => {
      if (!payload || !payload.sessionId) {
        setSelectedReplaySession(null)
        return
      }
      setSelectedReplaySession(payload)
    })
  }, [])

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

  const replaySessionBars = useMemo<ChartBar[]>(() => {
    const sourceBars = selectedReplaySession?.bars
    if (!Array.isArray(sourceBars) || sourceBars.length === 0) return []
    return sourceBars
      .filter((bar) => (
        Number.isFinite(bar.time)
        && Number.isFinite(bar.open)
        && Number.isFinite(bar.high)
        && Number.isFinite(bar.low)
        && Number.isFinite(bar.close)
      ))
      .sort((left, right) => left.time - right.time)
  }, [selectedReplaySession?.bars])

  const replaySnapshotSource = useMemo<ReplayAnalyticalSnapshot[] | undefined>(() => {
    if (Array.isArray(selectedReplaySession?.snapshots) && selectedReplaySession.snapshots.length > 0) {
      return selectedReplaySession.snapshots as unknown as ReplayAnalyticalSnapshot[]
    }
    return replaySnapshots
  }, [replaySnapshots, selectedReplaySession?.snapshots])

  const replayBarsSource = useMemo<ChartBar[]>(() => {
    if (replayEnabled && replaySessionBars.length > 0) {
      return replaySessionBars
    }
    return bars
  }, [bars, replayEnabled, replaySessionBars])

  const replayEngine = useMemo(() => {
    if (!replayEnabled) return null
    return createSPXReplayEngine(replayBarsSource, {
      windowMinutes: replayWindowMinutes,
      snapshots: replaySnapshotSource,
    })
  }, [replayBarsSource, replayEnabled, replaySnapshotSource, replayWindowMinutes])

  useEffect(() => {
    if (!replayEnabled || !replayEngine) {
      setReplayCursorIndex(null)
      lastReplayProgressBucketRef.current = null
      return
    }
    setReplayCursorIndex(replayEngine.firstCursorIndex)
    lastReplayProgressBucketRef.current = null
  }, [replayEnabled, replayEngine?.checksum, replayEngine])

  useEffect(() => {
    if (!replayEnabled || !replayPlaying || !replayEngine) return
    if (replayEngine.bars.length === 0) return

    const intervalMs = getSPXReplayIntervalMs(replaySpeed)
    const intervalId = window.setInterval(() => {
      setReplayCursorIndex((previous) => {
        const current = previous ?? replayEngine.firstCursorIndex
        if (replayEngine.isComplete(current)) return current
        return replayEngine.nextCursorIndex(current)
      })
    }, intervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [replayEnabled, replayEngine, replayPlaying, replaySpeed])

  const replayFrame = useMemo(() => {
    if (!replayEnabled || !replayEngine) return null
    return replayEngine.getFrame(replayCursorIndex ?? replayEngine.firstCursorIndex)
  }, [replayCursorIndex, replayEnabled, replayEngine])

  useEffect(() => {
    const sessionId = selectedReplaySession?.sessionId
    if (!sessionId || !replayEnabled) {
      publishReplayCursorTime(null)
      return
    }

    const cursorTimeSec = replayFrame?.currentBar?.time
    publishReplayCursorTime({
      sessionId,
      cursorTimeIso: cursorTimeSec != null ? new Date(cursorTimeSec * 1000).toISOString() : null,
      cursorTimeSec: cursorTimeSec ?? null,
    })
  }, [replayEnabled, replayFrame?.currentBar?.time, selectedReplaySession?.sessionId])

  useEffect(() => {
    if (!replayEnabled || !replayFrame) return
    const bucket = Math.floor(replayFrame.progress * 10)
    if (bucket === lastReplayProgressBucketRef.current) return
    lastReplayProgressBucketRef.current = bucket
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CHART_REPLAY_PROGRESS, {
      progress: replayFrame.progress,
      bucket,
      cursorIndex: replayFrame.cursorIndex,
      speed: replaySpeed,
      windowMinutes: replayWindowMinutes,
    })
  }, [replayEnabled, replayFrame, replaySpeed, replayWindowMinutes])

  const renderedBars = replayEnabled
    ? (replayFrame?.visibleBars || replayBarsSource)
    : bars

  const replayTimelineMarkers = useMemo<ChartEventMarker[]>(() => {
    if (!replayEnabled) return []
    const sessionId = selectedReplaySession?.sessionId
    if (!sessionId) return []

    const messages = Array.isArray(selectedReplaySession.messages)
      ? selectedReplaySession.messages
      : []
    const trades = Array.isArray(selectedReplaySession.trades)
      ? selectedReplaySession.trades
      : []

    const messageTimestampByRef = new Map<string, string>()
    for (const message of messages) {
      if (!message.sentAt) continue
      if (message.id) messageTimestampByRef.set(message.id, message.sentAt)
      if (message.discordMessageId) messageTimestampByRef.set(message.discordMessageId, message.sentAt)
    }

    const dedupe = new Set<string>()
    const markers: ChartEventMarker[] = []

    const pushMarker = (marker: {
      id: string
      kind: ReplayMarkerKind
      label: string
      timeIso: string | null
      source: string
    }) => {
      if (!marker.timeIso) return
      const timeSec = toEpochSeconds(marker.timeIso)
      if (timeSec == null) return
      const dedupeKey = `${marker.kind}|${marker.timeIso}|${marker.label}`
      if (dedupe.has(dedupeKey)) return
      dedupe.add(dedupeKey)
      markers.push({
        id: marker.id,
        kind: marker.kind,
        sessionId,
        label: marker.label,
        date: marker.timeIso,
        markerTimeSec: timeSec,
        impact: markerImpactForKind(marker.kind),
        source: marker.source,
      })
    }

    for (const trade of trades) {
      const tradeIndex = Number.isFinite(trade.tradeIndex) ? trade.tradeIndex : 0
      const tradeToken = trade.id || `trade-${tradeIndex}`
      pushMarker({
        id: `entry-${tradeToken}`,
        kind: 'entry',
        label: `Entry #${tradeIndex}`,
        timeIso: trade.entryTimestamp,
        source: 'Replay entry',
      })
      pushMarker({
        id: `exit-${tradeToken}`,
        kind: 'exit',
        label: `Exit #${tradeIndex}`,
        timeIso: trade.exitTimestamp,
        source: 'Replay exit',
      })

      const lifecycleEvents = Array.isArray(trade.lifecycleEvents) ? trade.lifecycleEvents : []
      for (const [index, event] of lifecycleEvents.entries()) {
        const kind = normalizeLifecycleMarkerKind(event.type)
        if (!kind) continue
        const timeIso = event.timestamp || (event.messageRef ? (messageTimestampByRef.get(event.messageRef) || null) : null)
        pushMarker({
          id: `${kind}-${tradeToken}-${index}`,
          kind,
          label: lifecycleMarkerLabel(kind, tradeIndex, event.value),
          timeIso,
          source: `Replay ${kind}`,
        })
      }

      if (trade.thesisText) {
        const thesisTime = (
          (trade.thesisMessageRef ? (messageTimestampByRef.get(trade.thesisMessageRef) || null) : null)
          || trade.entryTimestamp
          || trade.exitTimestamp
        )
        pushMarker({
          id: `thesis-trade-${tradeToken}`,
          kind: 'thesis',
          label: `Thesis #${tradeIndex}`,
          timeIso: thesisTime,
          source: 'Trade thesis',
        })
      }
    }

    for (const [index, message] of messages.entries()) {
      if (!isReplayThesisMessage(message)) continue
      pushMarker({
        id: `thesis-message-${message.id || index}`,
        kind: 'thesis',
        label: 'Caller Thesis',
        timeIso: message.sentAt,
        source: 'Transcript thesis',
      })
    }

    return markers.sort((left, right) => {
      const leftSec = toEpochSeconds(left.date) ?? 0
      const rightSec = toEpochSeconds(right.date) ?? 0
      if (leftSec !== rightSec) return leftSec - rightSec
      return String(left.id || '').localeCompare(String(right.id || ''))
    })
  }, [replayEnabled, selectedReplaySession])

  const handleReplayMarkerClick = useCallback((marker: ChartEventMarker) => {
    const sessionId = selectedReplaySession?.sessionId
    if (!sessionId) return
    const jumpTimeIso = marker.date || null
    if (!jumpTimeIso) return
    publishReplayTranscriptJump({
      sessionId,
      jumpTimeIso,
      source: marker.kind === 'entry' || marker.kind === 'exit'
        ? 'chart_marker'
        : 'lifecycle_marker',
    })
  }, [selectedReplaySession?.sessionId])

  const actionableSetupVisible = useMemo(() => {
    if (!selectedSetup) return false
    return tradeMode === 'in_trade' || selectedSetup.status === 'ready' || selectedSetup.status === 'triggered'
  }, [selectedSetup, tradeMode])

  // Extract last bar close as a stable primitive for memo dependency (Audit #8 MEDIUM-3)
  const lastBarClose = renderedBars[renderedBars.length - 1]?.close ?? null

  const scenarioLanes = useMemo(() => {
    if (!renderLevelAnnotations) return []
    if (!actionableSetupVisible) return []
    const referencePrice = lastBarClose ?? (spxPrice > 0 ? spxPrice : null)
    return buildSPXScenarioLanes(selectedSetup, referencePrice)
  }, [actionableSetupVisible, lastBarClose, renderLevelAnnotations, selectedSetup, spxPrice])

  useEffect(() => {
    const signature = scenarioLanes.map((lane) => `${lane.type}:${lane.price}`).join('|')
    if (!signature || signature === lastScenarioSignatureRef.current) return
    lastScenarioSignatureRef.current = signature
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CHART_SCENARIO_LANES_RENDERED, {
      setupId: selectedSetup?.id || null,
      laneCount: scenarioLanes.length,
      focusMode,
      replayEnabled,
    })
  }, [focusMode, replayEnabled, scenarioLanes, selectedSetup?.id])

  const resolvedLevels = useMemo(() => {
    const replaySnapshotLevels = replayFrame?.snapshot?.levels
    if (!replayEnabled) return levels
    if (!Array.isArray(replaySnapshotLevels) || replaySnapshotLevels.length === 0) return levels
    return replaySnapshotLevels
  }, [levels, replayEnabled, replayFrame?.snapshot?.levels])

  const levelAnnotations = useMemo<LevelAnnotation[]>(() => {
    const compact = typeof window !== 'undefined' && window.innerWidth < 768
    return resolvedLevels.map((level) => ({
      ...(isVWAPLevel(level)
        ? {
          label: 'VWAP',
          color: 'rgba(234, 179, 8, 0.88)',
          lineStyle: 'dashed' as const,
          lineWidth: Math.max(2, level.chartStyle.lineWidth),
          type: 'vwap',
        }
        : {
          label: chartLevelLabel(level, compact),
          color: level.chartStyle.color,
          lineStyle: toLineStyle(level.chartStyle.lineStyle),
          lineWidth: level.chartStyle.lineWidth,
          type: level.category,
        }),
      price: level.price,
      axisLabelVisible: !compact || level.strength === 'strong',
      strength: level.strength,
      description: typeof level.metadata.description === 'string'
        ? level.metadata.description
        : `${chartLevelLabel(level)}${isSpyDerivedLevel(level) ? ' (SPY impact projection)' : ''}`,
      testsToday: typeof level.metadata.testsToday === 'number' ? level.metadata.testsToday : undefined,
      lastTest: typeof level.metadata.lastTestAt === 'string' ? level.metadata.lastTestAt : null,
      holdRate: typeof level.metadata.holdRate === 'number' ? level.metadata.holdRate : null,
      displayContext: typeof level.metadata.displayContext === 'string' ? level.metadata.displayContext : undefined,
    }))
  }, [resolvedLevels])

  const targetFocusedLevelCount = selectedSetup ? 8 : 6

  const focusedLevelCandidates = useMemo<LevelAnnotation[]>(() => {
    if (levelAnnotations.length === 0) return []
    const livePrice = renderedBars[renderedBars.length - 1]?.close || (spxPrice > 0 ? spxPrice : null)

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
  }, [levelAnnotations, renderedBars, spxPrice, targetFocusedLevelCount])

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
    if (!actionableSetupVisible) return []

    return chartAnnotations.reduce<LevelAnnotation[]>((acc, annotation) => {
      if (annotation.type === 'entry_zone' && annotation.priceLow != null && annotation.priceHigh != null) {
        // Subtle boundary lines — the filled rectangle is rendered by PriorityLevelOverlay
        acc.push(
          {
            price: annotation.priceLow,
            label: `${annotation.label} Low`,
            color: 'rgba(16,185,129,0.35)',
            lineStyle: 'dashed',
            lineWidth: 0.75,
            axisLabelVisible: true,
            type: annotation.type,
          },
          {
            price: annotation.priceHigh,
            label: `${annotation.label} High`,
            color: 'rgba(16,185,129,0.35)',
            lineStyle: 'dashed',
            lineWidth: 0.75,
            axisLabelVisible: true,
            type: annotation.type,
          },
        )
        return acc
      }

      if (annotation.price != null) {
        const isStop = annotation.type === 'stop'
        const isTarget2 = annotation.type === 'target2' || /(^|\b)t2\b|target 2/i.test(annotation.label || '')
        acc.push({
          price: annotation.price,
          label: annotation.label,
          color: isStop
            ? 'rgba(239,68,68,0.82)'
            : isTarget2
              ? 'rgba(16,185,129,0.52)'
              : 'rgba(16,185,129,0.82)',
          lineStyle: 'solid',
          lineWidth: isTarget2 ? 1.25 : 1.5,
          axisLabelVisible: true,
          type: annotation.type,
        })
      }

      return acc
    }, [])
  }, [actionableSetupVisible, chartAnnotations])

  const scenarioLaneAnnotations = useMemo<LevelAnnotation[]>(() => {
    return scenarioLanes.map((lane) => ({
      price: lane.price,
      label: lane.label,
      color: lane.type === 'adverse'
        ? 'rgba(251,113,133,0.72)'
        : lane.type === 'acceleration'
          ? 'rgba(34,211,238,0.72)'
          : 'rgba(16,185,129,0.72)',
      lineStyle: lane.type === 'base' ? 'solid' : 'dotted',
      lineWidth: lane.type === 'base' ? 2 : 1,
      axisLabelVisible: true,
      type: `scenario_${lane.type}`,
      description: lane.description,
    }))
  }, [scenarioLanes])

  const expandedBudget = useMemo<SPXLevelVisibilityBudget | undefined>(() => {
    if (focusMode === 'execution' || !showAllRelevantLevels) {
      return levelVisibilityBudget
    }
    const base = levelVisibilityBudget || {
      nearWindowPoints: 16,
      nearLabelBudget: 7,
      maxTotalLabels: 16,
      minGapPoints: 1.2,
      pixelCollisionGap: 16,
    }

    return {
      ...base,
      nearWindowPoints: Number.MAX_SAFE_INTEGER,
      nearLabelBudget: Math.max(base.nearLabelBudget, 256),
      maxTotalLabels: Math.max(base.maxTotalLabels, 512),
      minGapPoints: 0.01,
      pixelCollisionGap: 0,
    }
  }, [focusMode, levelVisibilityBudget, showAllRelevantLevels])
  const levelDedupeMode = useMemo<'semantic' | 'none'>(() => {
    return showAllRelevantLevels && focusMode !== 'execution' ? 'none' : 'semantic'
  }, [focusMode, showAllRelevantLevels])

  const marketDisplayedLevels = useMemo(() => {
    if (!renderLevelAnnotations) return []
    if (focusMode === 'execution') return focusedLevelAnnotations
    return showAllRelevantLevels ? levelAnnotations : focusedLevelAnnotations
  }, [focusMode, focusedLevelAnnotations, levelAnnotations, renderLevelAnnotations, showAllRelevantLevels])

  useEffect(() => {
    if (countReportingMode === 'disabled') return
    if (!renderLevelAnnotations) {
      onDisplayedLevelsChange?.(0, levelAnnotations.length + setupAnnotations.length + scenarioLaneAnnotations.length)
      return
    }
    onDisplayedLevelsChange?.(
      marketDisplayedLevels.length + setupAnnotations.length + scenarioLaneAnnotations.length,
      levelAnnotations.length + setupAnnotations.length + scenarioLaneAnnotations.length,
    )
  }, [
    levelAnnotations.length,
    marketDisplayedLevels.length,
    countReportingMode,
    onDisplayedLevelsChange,
    renderLevelAnnotations,
    scenarioLaneAnnotations.length,
    setupAnnotations.length,
  ])

  useEffect(() => {
    if (!onLatestBarTimeChange) return
    const latestBar = renderedBars[renderedBars.length - 1]
    onLatestBarTimeChange(latestBar && Number.isFinite(latestBar.time) ? latestBar.time : null)
  }, [onLatestBarTimeChange, renderedBars])

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

  const showCrosshairTooltip = crosshairSnapshot != null && (!mobileExpanded || touchHoldActive)

  useEffect(() => {
    if (showCrosshairTooltip === lastTooltipVisibilityRef.current) return
    lastTooltipVisibilityRef.current = showCrosshairTooltip
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CHART_INTERACTION_TOOLTIP, {
      visible: showCrosshairTooltip,
      mobileExpanded,
      focusMode,
      replayEnabled,
    })
  }, [focusMode, mobileExpanded, replayEnabled, showCrosshairTooltip])

  return (
    <section className={cn('relative h-full w-full', className)} data-testid="spx-chart-surface">
      <div className="pointer-events-none absolute left-2 top-2 z-[2]">
        <h3 className="rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/65">
          Price + Levels
        </h3>
      </div>
      {showCrosshairTooltip && crosshairSnapshot && (
        <div
          className="pointer-events-none absolute right-3 top-2.5 z-[6] rounded-lg border border-white/14 bg-[#080B10]/90 px-2.5 py-1.5 font-mono text-[10px] text-white/82 shadow-xl backdrop-blur"
          data-testid="spx-chart-ohlc-tooltip"
        >
          <p className="mb-1 text-[9px] uppercase tracking-[0.09em] text-white/55">
            {CHART_TOOLTIP_TIME_FORMATTER.format(new Date(crosshairSnapshot.timeSec * 1000))} ET
          </p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span className="text-white/55">O</span><span>{crosshairSnapshot.open.toFixed(2)}</span>
            <span className="text-white/55">H</span><span>{crosshairSnapshot.high.toFixed(2)}</span>
            <span className="text-white/55">L</span><span>{crosshairSnapshot.low.toFixed(2)}</span>
            <span className="text-white/55">C</span><span>{crosshairSnapshot.close.toFixed(2)}</span>
            <span className="text-white/55">Vol</span><span>{Math.round(crosshairSnapshot.volume ?? 0).toLocaleString()}</span>
          </div>
        </div>
      )}
      {replayEnabled && replayFrame && (
        <div
          className="pointer-events-none absolute left-2 top-10 z-[5] inline-flex items-center gap-1.5 rounded-md border border-champagne/35 bg-[#0A0A0B]/82 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-champagne"
          data-testid="spx-chart-replay-status"
        >
          <span>{replayPlaying ? `Replay ${replaySpeed}x` : 'Replay Paused'}</span>
          <span>{Math.round(replayFrame.progress * 100)}%</span>
          <span>{replayWindowMinutes}m</span>
        </div>
      )}
      {scenarioLanes.length > 0 && focusMode !== 'risk_only' && (
        <div className="pointer-events-none absolute left-2 top-12 z-[5] flex max-w-[72%] flex-wrap items-center gap-1.5" data-testid="spx-chart-scenario-lanes">
          {scenarioLanes.map((lane) => (
            <span
              key={lane.id}
              className={cn(
                'rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.07em]',
                lane.type === 'base'
                  ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
                  : lane.type === 'adverse'
                    ? 'border-rose-300/35 bg-rose-500/12 text-rose-100'
                    : 'border-sky-300/35 bg-sky-500/12 text-sky-100',
              )}
            >
              {lane.label} {lane.price.toFixed(1)}
            </span>
          ))}
        </div>
      )}
      <div className={cn(mobileExpanded ? 'h-[55vh] min-h-[320px] max-h-[500px]' : 'h-full')}>
        <div
          className="h-full w-full"
          onTouchStart={() => setTouchHoldActive(true)}
          onTouchEnd={() => setTouchHoldActive(false)}
          onTouchCancel={() => setTouchHoldActive(false)}
        >
          <TradingChart
            symbol="SPX"
            timeframe={selectedTimeframe}
            bars={renderedBars}
            levels={renderLevelAnnotations ? [...marketDisplayedLevels, ...setupAnnotations, ...scenarioLaneAnnotations] : []}
            eventMarkers={replayTimelineMarkers}
            onEventMarkerClick={handleReplayMarkerClick}
            futureOffsetBars={futureOffsetBars}
            isLoading={isLoading}
            levelVisibilityBudget={expandedBudget}
            levelDedupeMode={levelDedupeMode}
            onChartReady={onChartReady}
            onCrosshairSnapshot={setCrosshairSnapshot}
            onLevelLayoutStats={handleLevelLayoutStats}
          />
        </div>
      </div>
    </section>
  )
}
