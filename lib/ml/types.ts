import type {
  BasisState,
  FlowEvent,
  GEXProfile,
  PredictionState,
  Regime,
  Setup,
  SetupTier,
} from '@/lib/types/spx-command-center'

export type MLSetupTier = Exclude<SetupTier, 'hidden'> | 'skip'

export interface SetupFeatureVector {
  // Confluence features
  confluenceScore: number
  confluenceFlowAge: number
  confluenceEmaAlignment: number
  confluenceGexAlignment: number

  // Regime features
  regimeType: number
  regimeCompatibility: number
  regimeAge: number

  // Flow features
  flowBias: number
  flowRecency: number
  flowVolume: number
  flowSweepCount: number

  // Price structure
  distanceToVWAP: number
  distanceToNearestCluster: number
  atr14: number
  atr7_14_ratio: number

  // Options features
  ivRank: number
  ivSkew: number
  putCallRatio: number
  netGex: number

  // Time features
  minutesIntoSession: number
  dayOfWeek: number
  dte: number

  // Memory features
  historicalWinRate: number
  historicalTestCount: number
  lastTestResult: number
}

export interface FeatureExtractionMetrics {
  distanceToVWAP?: number
  atr14?: number
  atr7?: number
  ivRank?: number
  ivSkew?: number
  putCallRatio?: number
  dte?: number
}

export interface FeatureExtractionContext {
  regime: Regime | null
  prediction: PredictionState | null
  basis: BasisState | null
  gex: GEXProfile | null
  flowEvents: FlowEvent[]
  nowMs?: number
  metrics?: FeatureExtractionMetrics
  userId?: string | null
  mlConfidenceEnabled?: boolean
  mlTierEnabled?: boolean
  mlConfluenceEnabled?: boolean
}

export interface ConfidenceModelWeights {
  version: string
  intercept: number
  features: Partial<Record<keyof SetupFeatureVector, number>>
  updatedAt?: string
}

export interface TierThresholds {
  sniperPrimary: number
  sniperSecondary: number
  watchlist: number
}

export type TierThresholdBySetupType = Partial<Record<Setup['type'], TierThresholds>>

export interface TierModelWeights {
  version: string
  interceptByTier: Record<MLSetupTier, number>
  featureWeightsByTier: Record<MLSetupTier, Partial<Record<keyof SetupFeatureVector, number>>>
  thresholdsBySetupType?: TierThresholdBySetupType
  updatedAt?: string
}

export interface MTFConfluenceWeights {
  version: string
  hiddenLayer: {
    weights: number[][]
    bias: number[]
  }
  outputLayer: {
    weights: number[]
    bias: number
  }
  updatedAt?: string
}
