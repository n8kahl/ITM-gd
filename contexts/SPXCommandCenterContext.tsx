'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { postSPXStream } from '@/hooks/use-spx-api'
import { usePriceStream } from '@/hooks/use-price-stream'
import { useSPXSnapshot } from '@/hooks/use-spx-snapshot'
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

  const activeSetups = useMemo(
    () => (snapshotData?.setups || []).filter((setup) => ACTIONABLE_SETUP_STATUSES.has(setup.status)),
    [snapshotData?.setups],
  )
  const allLevels = useMemo(() => snapshotData?.levels || [], [snapshotData?.levels])

  const selectedSetup = useMemo(() => {
    if (!selectedSetupId) return activeSetups[0] || null
    return activeSetups.find((setup) => setup.id === selectedSetupId) || activeSetups[0] || null
  }, [activeSetups, selectedSetupId])

  const spxPrice = stream.prices.get('SPX')?.price ?? snapshotData?.basis?.spxPrice ?? 0
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

  const toggleLevelCategory = useCallback((category: LevelCategory) => {
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
    setShowSPYDerived((prev) => !prev)
  }, [])

  const selectSetup = useCallback((setup: Setup | null) => {
    setSelectedSetupId(setup?.id || null)
    if (setup) {
      setSelectedTimeframe('5m')
    }
  }, [])

  const requestContractRecommendation = useCallback(async (setupId: string) => {
    if (!accessToken) {
      return null
    }

    const response = await fetch(`/api/spx/contract-select?setupId=${encodeURIComponent(setupId)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    return response.json() as Promise<ContractRecommendation>
  }, [accessToken])

  const sendCoachMessage = useCallback(async (prompt: string, setupId?: string | null) => {
    if (!accessToken) {
      throw new Error('Missing session token for SPX coach request')
    }

    const streamMessages = await postSPXStream<CoachMessage>('/api/spx/coach/message', accessToken, {
      prompt,
      setupId: setupId || undefined,
    })
    const nextMessages = streamMessages.filter((message) => Boolean(message?.id))
    if (nextMessages.length === 0) {
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

    return nextMessages[0]
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

  const value = useMemo<SPXCommandCenterState>(() => ({
    dataHealth,
    dataHealthMessage,
    spxPrice,
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
    showSPYDerived,
    snapshotData,
    stream.error,
    stream.isConnected,
    spxPrice,
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
