'use client'

import { createContext, useContext } from 'react'
import type { ContractRecommendation, LevelCategory, Setup, SPXStandbyGuidance } from '@/lib/types/spx-command-center'

type TradeMode = 'scan' | 'in_trade'

export interface SPXChartAnnotation {
  id: string
  type: 'entry_zone' | 'stop' | 'target'
  priceLow?: number
  priceHigh?: number
  price?: number
  label: string
}

export interface SPXActiveTradePlan {
  setupId: string
  direction: Setup['direction']
  regime: Setup['regime']
  status: Setup['status']
  entryLow: number
  entryHigh: number
  entryAnchor: number | null
  stop: number
  target1Price: number
  target1Label: string
  target2Price: number
  target2Label: string
  probability: number
  confluenceScore: number
  contract: ContractRecommendation | null
  contractSignature: string | null
  entryContractMid: number | null
  currentContractMid: number | null
  pnlPoints: number | null
  pnlDollars: number | null
  enteredAt: string | null
}

export interface SPXSetupContextState {
  activeSetups: Setup[]
  standbyGuidance: SPXStandbyGuidance | null
  selectedSetup: Setup | null
  tradeMode: TradeMode
  inTradeSetup: Setup | null
  inTradeSetupId: string | null
  activeTradePlan: SPXActiveTradePlan | null
  selectedSetupContract: ContractRecommendation | null
  inTradeContract: ContractRecommendation | null
  tradeEntryPrice: number | null
  tradeEnteredAt: string | null
  tradePnlPoints: number | null
  tradeEntryContractMid: number | null
  tradeCurrentContractMid: number | null
  tradePnlDollars: number | null
  chartAnnotations: SPXChartAnnotation[]
  selectSetup: (setup: Setup | null) => void
  setSetupContractChoice: (setup: Setup | null, contract: ContractRecommendation | null) => void
  enterTrade: (setup?: Setup | null) => void
  exitTrade: () => void
  requestContractRecommendation: (setup: Setup) => Promise<ContractRecommendation | null>
  visibleLevelCategories: Set<LevelCategory>
  showSPYDerived: boolean
  toggleLevelCategory: (category: LevelCategory) => void
  toggleSPYDerived: () => void
}

const SPXSetupContext = createContext<SPXSetupContextState | null>(null)

export function SPXSetupProvider({
  value,
  children,
}: {
  value: SPXSetupContextState
  children: React.ReactNode
}) {
  return (
    <SPXSetupContext.Provider value={value}>
      {children}
    </SPXSetupContext.Provider>
  )
}

export function useSPXSetupContext() {
  const context = useContext(SPXSetupContext)
  if (!context) {
    throw new Error('useSPXSetupContext must be used inside SPXSetupProvider')
  }

  return context
}
