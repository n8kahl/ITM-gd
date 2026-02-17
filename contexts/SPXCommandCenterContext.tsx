'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { postSPXStream } from '@/hooks/use-spx-api'
import { usePriceStream } from '@/hooks/use-price-stream'
import { useSPXSnapshot } from '@/hooks/use-spx-snapshot'
import { SPX_TELEMETRY_EVENT, startSPXPerfTimer, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import type {
  BasisState,
  ClusterZone,
  CoachMessage,
  ContractRecommendation,
  FibLevel,
  GEXProfile,
  LevelCategory,
  PredictionState,
  Regime,
  Setup,
  SPXLevel,
} from '@/lib/types/spx-command-center'

type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D'

interface ChartAnnotation {
  id: string
  type: 'entry_zone' | 'stop' | 'target'
  priceLow?: number
  priceHigh?: number
  price?: number
  label: string
}

interface SPXCommandCenterState {
  dataHealth: 'healthy' | 'degraded' | 'stale'
  dataHealthMessage: string | null
  spxPrice: number
  spxTickTimestamp: string | null
  spyPrice: number
  snapshotGeneratedAt: string | null
  priceStreamConnected: boolean
  priceStreamError: string | null
  basis: BasisState | null
  regime: Regime | null
  prediction: PredictionState | null
  levels: SPXLevel[]
  clusterZones: ClusterZone[]
  fibLevels: FibLevel[]
  gexProfile: { spx: GEXProfile; spy: GEXProfile; combined: GEXProfile } | null
  activeSetups: Setup[]
  coachMessages: CoachMessage[]
  selectedSetup: Setup | null
  selectedTimeframe: ChartTimeframe
  setChartTimeframe: (timeframe: ChartTimeframe) => void
  visibleLevelCategories: Set<LevelCategory>
  showSPYDerived: boolean
  chartAnnotations: ChartAnnotation[]
  flowEvents: Array<{
    id: string
    type: 'sweep' | 'block'
    symbol: 'SPX' | 'SPY'
    strike: number
    expiry: string
    size: number
    direction: 'bullish' | 'bearish'
    premium: number
    timestamp: string
  }>
  isLoading: boolean
  error: Error | null
  selectSetup: (setup: Setup | null) => void
  toggleLevelCategory: (category: LevelCategory) => void
  toggleSPYDerived: () => void
  requestContractRecommendation: (setupId: string) => Promise<ContractRecommendation | null>
  sendCoachMessage: (prompt: string, setupId?: string | null) => Promise<CoachMessage>
}

const ALL_CATEGORIES: LevelCategory[] = ['structural', 'tactical', 'intraday', 'options', 'spy_derived', 'fibonacci']
const ACTIONABLE_SETUP_STATUSES: ReadonlySet<Setup['status']> = new Set(['forming', 'ready', 'triggered'])
const IMMEDIATELY_ACTIONABLE_STATUSES: ReadonlySet<Setup['status']> = new Set(['ready', 'triggered'])
const SETUP_STATUS_PRIORITY: Record<Setup['status'], number> = {
  triggered: 0,
  ready: 1,
  forming: 2,
  invalidated: 3,
  expired: 4,
}

function toEpoch(value: string | null | undefined): number {
  if (!value) return 0
  const epoch = Date.parse(value)
  return Number.isFinite(epoch) ? epoch : 0
}

function rankSetups(setups: Setup[]): Setup[] {
  return [...setups].sort((a, b) => {
    const statusDelta = SETUP_STATUS_PRIORITY[a.status] - SETUP_STATUS_PRIORITY[b.status]
    if (statusDelta !== 0) return statusDelta
    if (b.confluenceScore !== a.confluenceScore) return b.confluenceScore - a.confluenceScore
    if (b.probability !== a.probability) return b.probability - a.probability

    const recencyA = a.triggeredAt ? toEpoch(a.triggeredAt) : toEpoch(a.createdAt)
    const recencyB = b.triggeredAt ? toEpoch(b.triggeredAt) : toEpoch(b.createdAt)
    if (recencyB !== recencyA) return recencyB - recencyA

    return a.id.localeCompare(b.id)
  })
}

const SPXCommandCenterContext = createContext<SPXCommandCenterState | null>(null)

export function SPXCommandCenterProvider({ children }: { children: React.ReactNode }) {
  const { session } = useMemberAuth()
  const {
    snapshot: snapshotData,
    isDegraded: snapshotIsDegraded,
    degradedMessage: snapshotDegradedMessage,
    isLoading,
    error: snapshotError,
    mutate: mutateSnapshot,
  } = useSPXSnapshot()
  const accessToken = session?.access_token || null

  const stream = usePriceStream(['SPX', 'SPY'], true, accessToken)
  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>('5m')
  const [visibleLevelCategories, setVisibleLevelCategories] = useState<Set<LevelCategory>>(new Set(ALL_CATEGORIES))
  const [showSPYDerived, setShowSPYDerived] = useState(true)
  const pageToFirstActionableStopperRef = useRef<null | ((payload?: Record<string, unknown>) => number | null)>(null)
  const pageToFirstSetupSelectStopperRef = useRef<null | ((payload?: Record<string, unknown>) => number | null)>(null)
  const hasTrackedFirstActionableRef = useRef(false)
  const hasTrackedFirstSetupSelectRef = useRef(false)
  const hasTrackedPageViewRef = useRef(false)
  const lastDataHealthRef = useRef<'healthy' | 'degraded' | 'stale' | null>(null)

  const activeSetups = useMemo(() => {
    const filtered = (snapshotData?.setups || []).filter((setup) => ACTIONABLE_SETUP_STATUSES.has(setup.status))
    return rankSetups(filtered)
  }, [snapshotData?.setups])
  const allLevels = useMemo(() => snapshotData?.levels || [], [snapshotData?.levels])

  const selectedSetup = useMemo(() => {
    const defaultSetup =
      activeSetups.find((setup) => IMMEDIATELY_ACTIONABLE_STATUSES.has(setup.status)) ||
      activeSetups[0] ||
      null
    if (!selectedSetupId) return defaultSetup
    return activeSetups.find((setup) => setup.id === selectedSetupId) || defaultSetup
  }, [activeSetups, selectedSetupId])

  const spxPrice = stream.prices.get('SPX')?.price ?? snapshotData?.basis?.spxPrice ?? 0
  const spxTickTimestamp = stream.prices.get('SPX')?.timestamp ?? null
  const spyPrice = stream.prices.get('SPY')?.price ?? snapshotData?.basis?.spyPrice ?? 0

  const chartAnnotations = useMemo<ChartAnnotation[]>(() => {
    if (!selectedSetup) return []

    return [
      {
        id: `${selectedSetup.id}-entry`,
        type: 'entry_zone',
        priceLow: selectedSetup.entryZone.low,
        priceHigh: selectedSetup.entryZone.high,
        label: 'Entry Zone',
      },
      {
        id: `${selectedSetup.id}-stop`,
        type: 'stop',
        price: selectedSetup.stop,
        label: 'Stop',
      },
      {
        id: `${selectedSetup.id}-target1`,
        type: 'target',
        price: selectedSetup.target1.price,
        label: selectedSetup.target1.label,
      },
      {
        id: `${selectedSetup.id}-target2`,
        type: 'target',
        price: selectedSetup.target2.price,
        label: selectedSetup.target2.label,
      },
    ]
  }, [selectedSetup])

  const filteredLevels = useMemo(() => {
    return allLevels
      .filter((level) => visibleLevelCategories.has(level.category))
      .filter((level) => (showSPYDerived ? true : level.category !== 'spy_derived'))
  }, [allLevels, showSPYDerived, visibleLevelCategories])

  useEffect(() => {
    if (hasTrackedPageViewRef.current) return
    hasTrackedPageViewRef.current = true

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.PAGE_VIEW, {
      route: '/members/spx-command-center',
      hasSession: Boolean(accessToken),
    }, { persist: true })
    pageToFirstActionableStopperRef.current = startSPXPerfTimer('ttfa_actionable_render')
    pageToFirstSetupSelectStopperRef.current = startSPXPerfTimer('ttfa_setup_select')
  }, [accessToken])

  useEffect(() => {
    if (hasTrackedFirstActionableRef.current) return

    const firstActionable = activeSetups.find((setup) => IMMEDIATELY_ACTIONABLE_STATUSES.has(setup.status))
    if (!firstActionable) return

    hasTrackedFirstActionableRef.current = true
    const durationMs = pageToFirstActionableStopperRef.current?.({
      setupId: firstActionable.id,
      setupStatus: firstActionable.status,
      setupDirection: firstActionable.direction,
    }) ?? null

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.FIRST_ACTIONABLE_RENDER, {
      setupId: firstActionable.id,
      setupStatus: firstActionable.status,
      setupDirection: firstActionable.direction,
      durationMs,
    }, { persist: true })
  }, [activeSetups])

  const toggleLevelCategory = useCallback((category: LevelCategory) => {
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.LEVEL_MAP_INTERACTION, {
      action: 'toggle_category',
      category,
    })

    setVisibleLevelCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }

      if (next.size === 0) {
        return new Set([category])
      }

      return next
    })
  }, [])

  const toggleSPYDerived = useCallback(() => {
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.LEVEL_MAP_INTERACTION, {
      action: 'toggle_spy_overlay',
    })
    setShowSPYDerived((prev) => !prev)
  }, [])

  const selectSetup = useCallback((setup: Setup | null) => {
    if (setup) {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SETUP_SELECTED, {
        setupId: setup.id,
        setupType: setup.type,
        setupStatus: setup.status,
        setupDirection: setup.direction,
        setupProbability: setup.probability,
      }, { persist: true })

      if (!hasTrackedFirstSetupSelectRef.current) {
        hasTrackedFirstSetupSelectRef.current = true
        const durationMs = pageToFirstSetupSelectStopperRef.current?.({
          setupId: setup.id,
        }) ?? null

        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.FIRST_SETUP_SELECT, {
          setupId: setup.id,
          durationMs,
        }, { persist: true })
      }
    }

    setSelectedSetupId(setup?.id || null)
    if (setup) {
      setSelectedTimeframe('5m')
    }
  }, [])

  const setChartTimeframe = useCallback((timeframe: ChartTimeframe) => {
    setSelectedTimeframe(timeframe)
  }, [])

  const requestContractRecommendation = useCallback(async (setupId: string) => {
    const stopTimer = startSPXPerfTimer('contract_recommendation_latency')

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_REQUESTED, {
      setupId,
    }, { persist: true })

    if (!accessToken) {
      const durationMs = stopTimer({ setupId, result: 'missing_token' })
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_RESULT, {
        setupId,
        result: 'missing_token',
        durationMs,
      }, { level: 'warning', persist: true })
      return null
    }

    try {
      const response = await fetch(`/api/spx/contract-select?setupId=${encodeURIComponent(setupId)}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        const durationMs = stopTimer({
          setupId,
          result: 'http_error',
          status: response.status,
        })
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_RESULT, {
          setupId,
          result: 'http_error',
          status: response.status,
          durationMs,
        }, { level: response.status >= 500 ? 'error' : 'warning', persist: true })
        return null
      }

      const recommendation = await response.json() as ContractRecommendation
      const durationMs = stopTimer({
        setupId,
        result: 'success',
      })
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_RESULT, {
        setupId,
        result: 'success',
        durationMs,
        strike: recommendation.strike,
        contractType: recommendation.type,
        riskReward: recommendation.riskReward,
      }, { persist: true })

      return recommendation
    } catch (error) {
      const durationMs = stopTimer({
        setupId,
        result: 'exception',
      })
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONTRACT_RESULT, {
        setupId,
        result: 'exception',
        durationMs,
        message: error instanceof Error ? error.message : 'Unknown contract request failure',
      }, { level: 'error', persist: true })
      return null
    }
  }, [accessToken])

  const sendCoachMessage = useCallback(async (prompt: string, setupId?: string | null) => {
    const stopTimer = startSPXPerfTimer('coach_message_roundtrip')

    if (!accessToken) {
      stopTimer({ setupId: setupId || null, result: 'missing_token' })
      throw new Error('Missing session token for SPX coach request')
    }

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_MESSAGE_SENT, {
      setupId: setupId || null,
      promptLength: prompt.length,
    })

    try {
      const streamMessages = await postSPXStream<CoachMessage>('/api/spx/coach/message', accessToken, {
        prompt,
        setupId: setupId || undefined,
      })
      const nextMessages = streamMessages.filter((message) => Boolean(message?.id))
      if (nextMessages.length === 0) {
        stopTimer({ setupId: setupId || null, result: 'empty_response' })
        throw new Error('SPX coach returned no messages')
      }

      await mutateSnapshot((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          coachMessages: [...nextMessages, ...prev.coachMessages],
          generatedAt: new Date().toISOString(),
        }
      }, false)

      stopTimer({
        setupId: setupId || null,
        result: 'success',
        messageCount: nextMessages.length,
      })

      return nextMessages[0]
    } catch (error) {
      stopTimer({
        setupId: setupId || null,
        result: 'exception',
      })
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_MESSAGE_SENT, {
        setupId: setupId || null,
        promptLength: prompt.length,
        result: 'error',
        message: error instanceof Error ? error.message : 'Unknown coach request failure',
      }, { level: 'error' })
      throw error
    }
  }, [accessToken, mutateSnapshot])

  const error = snapshotError || null
  const dataHealth = useMemo<'healthy' | 'degraded' | 'stale'>(() => {
    if (snapshotIsDegraded || error) return 'degraded'
    if (!stream.isConnected && Boolean(snapshotData?.generatedAt)) return 'stale'
    return 'healthy'
  }, [error, snapshotData?.generatedAt, snapshotIsDegraded, stream.isConnected])

  const dataHealthMessage = useMemo(() => {
    if (snapshotIsDegraded) {
      return snapshotDegradedMessage || 'SPX service is running in degraded mode.'
    }
    if (error?.message) {
      return error.message
    }
    if (dataHealth === 'stale') {
      return 'Live stream disconnected and snapshot is stale. Reconnecting in background.'
    }
    return null
  }, [dataHealth, error, snapshotDegradedMessage, snapshotIsDegraded])

  useEffect(() => {
    if (lastDataHealthRef.current === dataHealth) return
    lastDataHealthRef.current = dataHealth

    if (dataHealth !== 'healthy') {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.DATA_HEALTH_CHANGED, {
        dataHealth,
        message: dataHealthMessage,
      }, { level: dataHealth === 'degraded' ? 'warning' : 'info' })
    }
  }, [dataHealth, dataHealthMessage])

  const value = useMemo<SPXCommandCenterState>(() => ({
    dataHealth,
    dataHealthMessage,
    spxPrice,
    spxTickTimestamp,
    spyPrice,
    snapshotGeneratedAt: snapshotData?.generatedAt || null,
    priceStreamConnected: stream.isConnected,
    priceStreamError: stream.error,
    basis: snapshotData?.basis || null,
    regime: snapshotData?.regime?.regime || null,
    prediction: snapshotData?.prediction || null,
    levels: filteredLevels,
    clusterZones: snapshotData?.clusters || [],
    fibLevels: snapshotData?.fibLevels || [],
    gexProfile: snapshotData?.gex || null,
    activeSetups,
    coachMessages: snapshotData?.coachMessages || [],
    selectedSetup,
    selectedTimeframe,
    setChartTimeframe,
    visibleLevelCategories,
    showSPYDerived,
    chartAnnotations,
    flowEvents: snapshotData?.flow || [],
    isLoading,
    error,
    selectSetup,
    toggleLevelCategory,
    toggleSPYDerived,
    requestContractRecommendation,
    sendCoachMessage,
  }), [
    activeSetups,
    chartAnnotations,
    dataHealth,
    dataHealthMessage,
    error,
    filteredLevels,
    isLoading,
    requestContractRecommendation,
    selectSetup,
    sendCoachMessage,
    selectedSetup,
    selectedTimeframe,
    setChartTimeframe,
    showSPYDerived,
    snapshotData,
    stream.error,
    stream.isConnected,
    spxPrice,
    spxTickTimestamp,
    spyPrice,
    toggleLevelCategory,
    toggleSPYDerived,
    visibleLevelCategories,
  ])

  return (
    <SPXCommandCenterContext.Provider value={value}>
      {children}
    </SPXCommandCenterContext.Provider>
  )
}

export function useSPXCommandCenter() {
  const context = useContext(SPXCommandCenterContext)
  if (!context) {
    throw new Error('useSPXCommandCenter must be used inside SPXCommandCenterProvider')
  }

  return context
}
