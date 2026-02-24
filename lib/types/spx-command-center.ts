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

export type FlowWindowRange = '5m' | '15m' | '30m'
export type FlowDirectionalBias = 'bullish' | 'bearish' | 'neutral'

export interface FlowWindowSummary {
  window: FlowWindowRange
  startAt: string
  endAt: string
  eventCount: number
  sweepCount: number
  blockCount: number
  bullishPremium: number
  bearishPremium: number
  totalPremium: number
  flowScore: number
  bias: FlowDirectionalBias
}

export interface FlowWindowAggregation {
  generatedAt: string
  source: 'computed' | 'cached' | 'fallback'
  directionalBias: FlowDirectionalBias
  primaryWindow: FlowWindowRange
  latestEventAt: string | null
  windows: Record<FlowWindowRange, FlowWindowSummary>
}

// ─── Setup Types ───

export type SetupType =
  | 'fade_at_wall'
  | 'breakout_vacuum'
  | 'mean_reversion'
  | 'trend_continuation'
  | 'orb_breakout'
  | 'trend_pullback'
  | 'flip_reclaim'

export type SetupStatus = 'forming' | 'ready' | 'triggered' | 'invalidated' | 'expired'

export type SetupTier = 'sniper_primary' | 'sniper_secondary' | 'watchlist' | 'hidden'

export type SetupTriggerPattern =
  | 'engulfing_bull'
  | 'engulfing_bear'
  | 'doji'
  | 'hammer'
  | 'inverted_hammer'
  | 'none'

export type SetupInvalidationReason =
  | 'stop_breach_confirmed'
  | 'regime_conflict'
  | 'flow_divergence'
  | 'quality_gate_blocked'
  | 'regime_gate_blocked'
  | 'flow_gate_blocked'
  | 'drift_control_paused'
  | 'ttl_expired'
  | 'manual'
  | 'unknown'

export type Regime = 'trending' | 'ranging' | 'compression' | 'breakout'

export type SPXVixRegime = 'normal' | 'elevated' | 'extreme' | 'unknown'

export interface SPXEnvironmentGateBreakdownItem {
  passed: boolean
  reason?: string
  value?: number | null
}

export interface SPXEnvironmentGateDecision {
  passed: boolean
  reason: string | null
  reasons: string[]
  vixRegime: SPXVixRegime
  dynamicReadyThreshold: number
  caution: boolean
  breakdown: {
    vixRegime: SPXEnvironmentGateBreakdownItem & {
      regime: SPXVixRegime
      value: number | null
    }
    expectedMoveConsumption: SPXEnvironmentGateBreakdownItem & {
      value: number | null
      expectedMovePoints: number | null
    }
    macroCalendar: SPXEnvironmentGateBreakdownItem & {
      caution: boolean
      nextEvent: {
        event: string
        at: string
        minutesUntil: number
      } | null
    }
    sessionTime: SPXEnvironmentGateBreakdownItem & {
      minuteEt: number
      minutesUntilClose: number | null
      source: 'local' | 'massive' | 'cached'
    }
    compression: SPXEnvironmentGateBreakdownItem & {
      realizedVolPct: number | null
      impliedVolPct: number | null
      spreadPct: number | null
    }
    eventRisk?: SPXEnvironmentGateBreakdownItem & {
      caution: boolean
      blackout: boolean
      riskScore: number
      source: 'none' | 'macro' | 'news' | 'combined'
      nextEvent: {
        event: string
        at: string
        minutesUntil: number
      } | null
      newsSentimentScore: number | null
      marketMovingArticleCount: number
      recentHighImpactCount: number
      latestArticleAt: string | null
    }
  }
}

export interface SPXStandbyNearestSetup {
  setupId: string
  setupType: SetupType
  direction: Setup['direction']
  entryLevel: number
  stop: number
  target1: number
  target2: number
  estimatedProbability: number
  conditionsNeeded: string[]
}

export interface SPXStandbyWatchZone {
  level: number
  direction: Setup['direction']
  reason: string
  confluenceRequired: number
}

export interface SPXStandbyGuidance {
  status: 'STANDBY'
  reason: string
  waitingFor: string[]
  nearestSetup: SPXStandbyNearestSetup | null
  watchZones: SPXStandbyWatchZone[]
  nextCheckTime: string
  environment: {
    vixRegime: SPXVixRegime
    dynamicReadyThreshold: number
    caution: boolean
  }
}

export interface Setup {
  id: string
  stableIdHash?: string
  type: SetupType
  direction: 'bullish' | 'bearish'
  entryZone: { low: number; high: number }
  stop: number
  target1: { price: number; label: string }
  target2: { price: number; label: string }
  confluenceScore: number // 0-5
  confluenceSources: string[]
  confluenceBreakdown?: {
    flow: number
    ema: number
    zone: number
    gex: number
    regime: number
    multiTF: number
    memory: number
    composite: number
    legacyEquivalent: number
    threshold: number
  }
  clusterZone: ClusterZone
  regime: Regime
  status: SetupStatus
  score?: number
  pWinCalibrated?: number
  evR?: number
  evContext?: {
    model: 'adaptive'
    adjustedPWin: number
    expectedLossR: number
    blendedWinR: number
    t1Weight: number
    t2Weight: number
    slippageR: number
  }
  alignmentScore?: number
  flowConfirmed?: boolean
  gateStatus?: 'eligible' | 'blocked'
  gateReasons?: string[]
  tradeManagement?: {
    partialAtT1Pct: number
    moveStopToBreakeven: boolean
  }
  confidenceTrend?: 'up' | 'flat' | 'down'
  decisionDrivers?: string[]
  decisionRisks?: string[]
  zoneQualityScore?: number
  zoneQualityComponents?: {
    fortressScore: number
    structureScore: number
    touchHistoryScore: number
    compositeScore: number
  }
  morphHistory?: Array<{
    timestamp: string
    priorStop: number
    newStop: number
    priorTarget: number
    newTarget: number
  }>
  triggerContext?: {
    triggerBarTimestamp: string
    triggerBarPatternType: SetupTriggerPattern
    triggerBarVolume: number
    penetrationDepth: number
    triggerLatencyMs: number
  }
  memoryContext?: {
    tests: number
    resolved: number
    wins: number
    losses: number
    winRatePct: number | null
    confidence: number
    score: number
    lookbackSessions: number
    tolerancePoints: number
  }
  multiTFConfluence?: {
    score: number
    aligned: boolean
    tf1hStructureAligned: number
    tf15mSwingProximity: number
    tf5mMomentumAlignment: number
    tf1mMicrostructure: number
    contextSource?: 'computed' | 'cached' | 'fallback'
  }
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

// ─── Coach Decision Brief Types ───

export type CoachDecisionVerdict = 'ENTER' | 'WAIT' | 'REDUCE' | 'EXIT'

export type CoachDecisionSeverity = 'routine' | 'warning' | 'critical'

export type CoachDecisionSource = 'ai_v2' | 'fallback_v1'

export type CoachDecisionActionId =
  | 'ENTER_TRADE_FOCUS'
  | 'EXIT_TRADE_FOCUS'
  | 'REVERT_AI_CONTRACT'
  | 'TIGHTEN_STOP_GUIDANCE'
  | 'REDUCE_SIZE_GUIDANCE'
  | 'ASK_FOLLOW_UP'
  | 'OPEN_HISTORY'

export type CoachDecisionActionStyle = 'primary' | 'secondary' | 'ghost'

export interface CoachDecisionAction {
  id: CoachDecisionActionId
  label: string
  style: CoachDecisionActionStyle
  payload?: Record<string, unknown>
}

export interface CoachDecisionRiskPlan {
  invalidation?: string
  stop?: number
  maxRiskDollars?: number
  positionGuidance?: string
}

export interface CoachDecisionFreshness {
  generatedAt: string
  expiresAt: string
  stale: boolean
}

export interface CoachDecisionBrief {
  decisionId: string
  setupId: string | null
  verdict: CoachDecisionVerdict
  confidence: number
  primaryText: string
  why: string[]
  riskPlan?: CoachDecisionRiskPlan
  actions: CoachDecisionAction[]
  severity: CoachDecisionSeverity
  freshness: CoachDecisionFreshness
  contextHash?: string
  source: CoachDecisionSource
}

export interface CoachDecisionRequest {
  setupId?: string
  tradeMode?: 'scan' | 'evaluate' | 'in_trade'
  question?: string
  selectedContract?: Pick<ContractRecommendation, 'description' | 'bid' | 'ask' | 'riskReward'>
  clientContext?: {
    layoutMode?: 'legacy' | 'scan' | 'evaluate' | 'in_trade'
    surface?: string
  }
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
