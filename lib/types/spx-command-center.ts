// ─── Level Types ───

export type LevelCategory = 'structural' | 'tactical' | 'intraday' | 'options' | 'spy_derived' | 'fibonacci'

export type LevelStrength = 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical'

export type ZoneType = 'fortress' | 'defended' | 'moderate' | 'minor'

export interface SPXLevel {
  id: string
  symbol: 'SPX' | 'SPY'
  category: LevelCategory
  source: string
  price: number
  strength: LevelStrength
  timeframe: string
  metadata: Record<string, unknown>
  chartStyle: {
    color: string
    lineStyle: 'solid' | 'dashed' | 'dotted' | 'dot-dash'
    lineWidth: number
    labelFormat: string
  }
}

export interface ClusterZone {
  id: string
  priceLow: number
  priceHigh: number
  clusterScore: number
  type: ZoneType
  sources: Array<{ source: string; category: LevelCategory; price: number; instrument: 'SPX' | 'SPY' }>
  testCount: number
  lastTestAt: string | null
  held: boolean | null
  holdRate: number | null
}

// ─── Fibonacci Types ───

export interface FibLevel {
  ratio: number // 0.236, 0.382, 0.5, 0.618, 0.786, 1.272, 1.618, 2.0
  price: number
  timeframe: 'monthly' | 'weekly' | 'daily' | 'intraday'
  direction: 'retracement' | 'extension'
  swingHigh: number
  swingLow: number
  crossValidated: boolean // Confirmed by SPY equivalent
}

// ─── GEX Types ───

export interface GEXProfile {
  netGex: number
  flipPoint: number
  callWall: number
  putWall: number
  zeroGamma: number
  gexByStrike: Array<{ strike: number; gex: number }>
  keyLevels: Array<{ strike: number; gex: number; type: 'call_wall' | 'put_wall' | 'high_oi' }>
  expirationBreakdown: Record<string, { netGex: number; callWall: number; putWall: number }>
  timestamp: string
}

// ─── Flow Types ───

export interface FlowEvent {
  id: string
  type: 'sweep' | 'block'
  symbol: 'SPX' | 'SPY'
  strike: number
  expiry: string
  size: number
  direction: 'bullish' | 'bearish'
  premium: number
  timestamp: string
}

// ─── Setup Types ───

export type SetupType = 'fade_at_wall' | 'breakout_vacuum' | 'mean_reversion' | 'trend_continuation'

export type SetupStatus = 'forming' | 'ready' | 'triggered' | 'invalidated' | 'expired'

export type SetupTier = 'sniper_primary' | 'sniper_secondary' | 'watchlist' | 'hidden'

export type SetupInvalidationReason =
  | 'stop_breach_confirmed'
  | 'regime_conflict'
  | 'flow_divergence'
  | 'ttl_expired'
  | 'manual'
  | 'unknown'

export type Regime = 'trending' | 'ranging' | 'compression' | 'breakout'

export interface Setup {
  id: string
  type: SetupType
  direction: 'bullish' | 'bearish'
  entryZone: { low: number; high: number }
  stop: number
  target1: { price: number; label: string }
  target2: { price: number; label: string }
  confluenceScore: number // 0-5
  confluenceSources: string[]
  clusterZone: ClusterZone
  regime: Regime
  status: SetupStatus
  score?: number
  pWinCalibrated?: number
  evR?: number
  tier?: SetupTier
  rank?: number
  statusUpdatedAt?: string
  ttlExpiresAt?: string | null
  invalidationReason?: SetupInvalidationReason | null
  probability: number
  recommendedContract: ContractRecommendation | null
  createdAt: string
  triggeredAt: string | null
}

// ─── Prediction Types ───

export interface PredictionState {
  regime: Regime
  direction: { bullish: number; bearish: number; neutral: number }
  magnitude: { small: number; medium: number; large: number }
  timingWindow: { description: string; actionable: boolean }
  nextTarget: {
    upside: { price: number; zone: string }
    downside: { price: number; zone: string }
  }
  probabilityCone: Array<{
    minutesForward: number
    high: number
    low: number
    center: number
    confidence: number
  }>
  confidence: number
}

// ─── Coaching Types ───

export type CoachingType = 'pre_trade' | 'in_trade' | 'behavioral' | 'post_trade' | 'alert'

export type CoachingPriority = 'alert' | 'setup' | 'guidance' | 'behavioral'

export interface CoachMessage {
  id: string
  type: CoachingType
  priority: CoachingPriority
  setupId: string | null
  content: string
  structuredData: Record<string, unknown>
  timestamp: string
}

// ─── Contract Types ───

export interface ContractRecommendation {
  description: string // e.g., '5900P 0DTE'
  strike: number
  expiry: string
  type: 'call' | 'put'
  delta: number
  gamma: number
  theta: number
  vega: number
  bid: number
  ask: number
  riskReward: number
  expectedPnlAtTarget1: number
  expectedPnlAtTarget2: number
  maxLoss: number
  reasoning: string
  spreadPct?: number
  openInterest?: number
  volume?: number
  liquidityScore?: number
  daysToExpiry?: number
  premiumMid?: number
  premiumAsk?: number
  costBand?: 'discount' | 'balanced' | 'expensive'
  healthScore?: number
  healthTier?: 'green' | 'amber' | 'red'
  thetaRiskPer15m?: number
  ivVsRealized?: number
  alternatives?: Array<{
    description: string
    strike: number
    expiry: string
    type: 'call' | 'put'
    delta: number
    bid: number
    ask: number
    spreadPct: number
    liquidityScore: number
    maxLoss: number
    healthScore?: number
    healthTier?: 'green' | 'amber' | 'red'
    tag?: 'tighter' | 'safer' | 'higher_conviction'
    tradeoff?: string
    score: number
  }>
}

// ─── Basis Types ───

export interface BasisState {
  current: number
  trend: 'expanding' | 'contracting' | 'stable'
  leading: 'SPX' | 'SPY' | 'neutral'
  ema5: number
  ema20: number
  zscore: number
  spxPrice?: number
  spyPrice?: number
  timestamp?: string
}

export interface SpyImpactLevel {
  source: string
  spyLevel: number
  projectedSpx: number
  impactSpxPoints: number
  confidence: number
  confidenceBand: { low: number; high: number }
}

export interface SpyImpactState {
  beta: number
  correlation: number
  basisUsed: number
  spot: { spx: number; spy: number }
  levels: SpyImpactLevel[]
  timestamp: string
}

export interface ContractCandidate {
  strike: number
  expiry: string
  type: 'call' | 'put'
  delta: number
  gamma: number
  theta: number
  vega: number
  bid: number
  ask: number
}
