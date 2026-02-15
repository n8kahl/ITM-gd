'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { useSPXBasis } from '@/hooks/use-spx-basis'
import { useSPXCoach } from '@/hooks/use-spx-coach'
import { useSPXFibonacci } from '@/hooks/use-spx-fibonacci'
import { useSPXFlow } from '@/hooks/use-spx-flow'
import { useSPXGEX } from '@/hooks/use-spx-gex'
import { useSPXLevels } from '@/hooks/use-spx-levels'
import { useSPXRegime } from '@/hooks/use-spx-regime'
import { useSPXSetups } from '@/hooks/use-spx-setups'
import { usePriceStream } from '@/hooks/use-price-stream'
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
  spxPrice: number
  spyPrice: number
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

const SPXCommandCenterContext = createContext<SPXCommandCenterState | null>(null)

export function SPXCommandCenterProvider({ children }: { children: React.ReactNode }) {
  const { session } = useMemberAuth()
  const levels = useSPXLevels()
  const gex = useSPXGEX()
  const setups = useSPXSetups()
  const regime = useSPXRegime()
  const flow = useSPXFlow()
  const fib = useSPXFibonacci()
  const basis = useSPXBasis()
  const coach = useSPXCoach()

  const stream = usePriceStream(['SPX', 'SPY'])
  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>('5m')
  const [visibleLevelCategories, setVisibleLevelCategories] = useState<Set<LevelCategory>>(new Set(ALL_CATEGORIES))
  const [showSPYDerived, setShowSPYDerived] = useState(true)

  const selectedSetup = useMemo(() => {
    if (!selectedSetupId) return setups.setups[0] || null
    return setups.setups.find((setup) => setup.id === selectedSetupId) || setups.setups[0] || null
  }, [selectedSetupId, setups.setups])

  const spxPrice = stream.prices.get('SPX')?.price ?? basis.basis?.spxPrice ?? 0
  const spyPrice = stream.prices.get('SPY')?.price ?? basis.basis?.spyPrice ?? 0

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
    return levels.levels
      .filter((level) => visibleLevelCategories.has(level.category))
      .filter((level) => (showSPYDerived ? true : level.category !== 'spy_derived'))
  }, [levels.levels, showSPYDerived, visibleLevelCategories])

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
    if (!session?.access_token) {
      return null
    }

    const response = await fetch(`/api/spx/contract-select?setupId=${encodeURIComponent(setupId)}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    return response.json() as Promise<ContractRecommendation>
  }, [session])

  const isLoading = (
    levels.isLoading
    || gex.isLoading
    || setups.isLoading
    || regime.isLoading
    || fib.isLoading
    || basis.isLoading
    || coach.isLoading
    || flow.isLoading
  )

  const error = levels.error || gex.error || setups.error || regime.error || fib.error || basis.error || coach.error || flow.error || null

  const value = useMemo<SPXCommandCenterState>(() => ({
    spxPrice,
    spyPrice,
    basis: basis.basis,
    regime: regime.regime?.regime || null,
    prediction: regime.prediction,
    levels: filteredLevels,
    clusterZones: levels.clusterZones,
    fibLevels: fib.fibLevels,
    gexProfile: gex.gex,
    activeSetups: setups.setups,
    coachMessages: coach.messages,
    selectedSetup,
    selectedTimeframe,
    visibleLevelCategories,
    showSPYDerived,
    chartAnnotations,
    flowEvents: flow.events,
    isLoading,
    error,
    selectSetup,
    toggleLevelCategory,
    toggleSPYDerived,
    requestContractRecommendation,
    sendCoachMessage: coach.sendMessage,
  }), [
    basis.basis,
    chartAnnotations,
    coach.messages,
    coach.sendMessage,
    error,
    fib.fibLevels,
    filteredLevels,
    flow.events,
    gex.gex,
    isLoading,
    levels.clusterZones,
    regime.prediction,
    regime.regime?.regime,
    requestContractRecommendation,
    selectSetup,
    selectedSetup,
    selectedTimeframe,
    setups.setups,
    showSPYDerived,
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
