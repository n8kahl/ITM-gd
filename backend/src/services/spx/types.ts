export type LevelCategory = 'structural' | 'tactical' | 'intraday' | 'options' | 'spy_derived' | 'fibonacci';

export type LevelStrength = 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical';

export type ZoneType = 'fortress' | 'defended' | 'moderate' | 'minor';

export type SetupType =
  | 'fade_at_wall'
  | 'breakout_vacuum'
  | 'mean_reversion'
  | 'trend_continuation'
  | 'orb_breakout'
  | 'trend_pullback'
  | 'flip_reclaim';

export type SetupStatus = 'forming' | 'ready' | 'triggered' | 'invalidated' | 'expired';

export type Regime = 'trending' | 'ranging' | 'compression' | 'breakout';

export type SetupTier = 'sniper_primary' | 'sniper_secondary' | 'watchlist' | 'hidden';

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
  | 'unknown';

export interface SPXLevel {
  id: string;
  symbol: 'SPX' | 'SPY';
  category: LevelCategory;
  source: string;
  price: number;
  strength: LevelStrength;
  timeframe: string;
  metadata: Record<string, unknown>;
  chartStyle: {
    color: string;
    lineStyle: 'solid' | 'dashed' | 'dotted' | 'dot-dash';
    lineWidth: number;
    labelFormat: string;
  };
}

export interface ClusterZone {
  id: string;
  priceLow: number;
  priceHigh: number;
  clusterScore: number;
  type: ZoneType;
  sources: Array<{ source: string; category: LevelCategory; price: number; instrument: 'SPX' | 'SPY' }>;
  testCount: number;
  lastTestAt: string | null;
  held: boolean | null;
  holdRate: number | null;
}

export interface FibLevel {
  ratio: number;
  price: number;
  timeframe: 'monthly' | 'weekly' | 'daily' | 'intraday';
  direction: 'retracement' | 'extension';
  swingHigh: number;
  swingLow: number;
  crossValidated: boolean;
}

export interface GEXProfile {
  symbol: 'SPX' | 'SPY' | 'COMBINED';
  spotPrice: number;
  netGex: number;
  flipPoint: number;
  callWall: number;
  putWall: number;
  zeroGamma: number;
  gexByStrike: Array<{ strike: number; gex: number }>;
  keyLevels: Array<{ strike: number; gex: number; type: 'call_wall' | 'put_wall' | 'high_oi' }>;
  expirationBreakdown: Record<string, { netGex: number; callWall: number; putWall: number }>;
  timestamp: string;
}

export interface BasisState {
  current: number;
  trend: 'expanding' | 'contracting' | 'stable';
  leading: 'SPX' | 'SPY' | 'neutral';
  ema5: number;
  ema20: number;
  zscore: number;
  spxPrice: number;
  spyPrice: number;
  timestamp: string;
}

export interface SpyImpactLevel {
  source: string;
  spyLevel: number;
  projectedSpx: number;
  impactSpxPoints: number;
  confidence: number;
  confidenceBand: { low: number; high: number };
}

export interface SpyImpactState {
  beta: number;
  correlation: number;
  basisUsed: number;
  spot: { spx: number; spy: number };
  levels: SpyImpactLevel[];
  timestamp: string;
}

export interface ContractRecommendation {
  description: string;
  strike: number;
  expiry: string;
  type: 'call' | 'put';
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  bid: number;
  ask: number;
  riskReward: number;
  expectedPnlAtTarget1: number;
  expectedPnlAtTarget2: number;
  maxLoss: number;
  reasoning: string;
  spreadPct?: number;
  openInterest?: number;
  volume?: number;
  liquidityScore?: number;
  daysToExpiry?: number;
  premiumMid?: number;
  premiumAsk?: number;
  costBand?: 'discount' | 'balanced' | 'expensive';
  suggestedContracts?: number;
  sizing?: {
    maxRiskDollars: number;
    contractsByRisk: number;
    contractsByBuyingPower: number;
    perContractDebit: number;
    blockedReason?: 'margin_limit_blocked';
  };
  healthScore?: number;
  healthTier?: 'green' | 'amber' | 'red';
  thetaRiskPer15m?: number;
  ivVsRealized?: number;
  alternatives?: Array<{
    description: string;
    strike: number;
    expiry: string;
    type: 'call' | 'put';
    delta: number;
    bid: number;
    ask: number;
    spreadPct: number;
    liquidityScore: number;
    maxLoss: number;
    healthScore?: number;
    healthTier?: 'green' | 'amber' | 'red';
    tag?: 'tighter' | 'safer' | 'higher_conviction';
    tradeoff?: string;
    score: number;
  }>;
}

export interface Setup {
  id: string;
  type: SetupType;
  direction: 'bullish' | 'bearish';
  entryZone: { low: number; high: number };
  stop: number;
  target1: { price: number; label: string };
  target2: { price: number; label: string };
  confluenceScore: number;
  confluenceSources: string[];
  clusterZone: ClusterZone;
  regime: Regime;
  status: SetupStatus;
  score?: number;
  alignmentScore?: number;
  flowConfirmed?: boolean;
  gateStatus?: 'eligible' | 'blocked';
  gateReasons?: string[];
  tradeManagement?: {
    partialAtT1Pct: number;
    moveStopToBreakeven: boolean;
  };
  confidenceTrend?: 'up' | 'flat' | 'down';
  decisionDrivers?: string[];
  decisionRisks?: string[];
  pWinCalibrated?: number;
  evR?: number;
  tier?: SetupTier;
  rank?: number;
  statusUpdatedAt?: string;
  ttlExpiresAt?: string | null;
  invalidationReason?: SetupInvalidationReason | null;
  probability: number;
  recommendedContract: ContractRecommendation | null;
  createdAt: string;
  triggeredAt: string | null;
}

export interface PredictionState {
  regime: Regime;
  direction: { bullish: number; bearish: number; neutral: number };
  magnitude: { small: number; medium: number; large: number };
  timingWindow: { description: string; actionable: boolean };
  nextTarget: {
    upside: { price: number; zone: string };
    downside: { price: number; zone: string };
  };
  probabilityCone: Array<{
    minutesForward: number;
    high: number;
    low: number;
    center: number;
    confidence: number;
  }>;
  confidence: number;
}

export type CoachingType = 'pre_trade' | 'in_trade' | 'behavioral' | 'post_trade' | 'alert';

export type CoachingPriority = 'alert' | 'setup' | 'guidance' | 'behavioral';

export interface CoachMessage {
  id: string;
  type: CoachingType;
  priority: CoachingPriority;
  setupId: string | null;
  content: string;
  structuredData: Record<string, unknown>;
  timestamp: string;
}

export type CoachDecisionVerdict = 'ENTER' | 'WAIT' | 'REDUCE' | 'EXIT';

export type CoachDecisionSeverity = 'routine' | 'warning' | 'critical';

export type CoachDecisionSource = 'ai_v2' | 'fallback_v1';

export type CoachDecisionActionId =
  | 'ENTER_TRADE_FOCUS'
  | 'EXIT_TRADE_FOCUS'
  | 'REVERT_AI_CONTRACT'
  | 'TIGHTEN_STOP_GUIDANCE'
  | 'REDUCE_SIZE_GUIDANCE'
  | 'ASK_FOLLOW_UP'
  | 'OPEN_HISTORY';

export type CoachDecisionActionStyle = 'primary' | 'secondary' | 'ghost';

export interface CoachDecisionAction {
  id: CoachDecisionActionId;
  label: string;
  style: CoachDecisionActionStyle;
  payload?: Record<string, unknown>;
}

export interface CoachDecisionRiskPlan {
  invalidation?: string;
  stop?: number;
  maxRiskDollars?: number;
  positionGuidance?: string;
}

export interface CoachDecisionFreshness {
  generatedAt: string;
  expiresAt: string;
  stale: boolean;
}

export interface CoachDecisionBrief {
  decisionId: string;
  setupId: string | null;
  verdict: CoachDecisionVerdict;
  confidence: number;
  primaryText: string;
  why: string[];
  riskPlan?: CoachDecisionRiskPlan;
  actions: CoachDecisionAction[];
  severity: CoachDecisionSeverity;
  freshness: CoachDecisionFreshness;
  contextHash?: string;
  source: CoachDecisionSource;
}

export interface CoachDecisionRequest {
  setupId?: string;
  tradeMode?: 'scan' | 'evaluate' | 'in_trade';
  question?: string;
  selectedContract?: Pick<ContractRecommendation, 'description' | 'bid' | 'ask' | 'riskReward'>;
  clientContext?: {
    layoutMode?: 'legacy' | 'scan' | 'evaluate' | 'in_trade';
    surface?: string;
  };
}

export interface RegimeState {
  regime: Regime;
  direction: 'bullish' | 'bearish' | 'neutral';
  probability: number;
  magnitude: 'small' | 'medium' | 'large';
  confidence: number;
  timestamp: string;
}

export interface SPXFlowEvent {
  id: string;
  type: 'sweep' | 'block';
  symbol: 'SPX' | 'SPY';
  strike: number;
  expiry: string;
  size: number;
  direction: 'bullish' | 'bearish';
  premium: number;
  timestamp: string;
}

export interface UnifiedGEXLandscape {
  spx: GEXProfile;
  spy: GEXProfile;
  combined: GEXProfile;
}

export interface SPXSnapshot {
  levels: SPXLevel[];
  clusters: ClusterZone[];
  fibLevels: FibLevel[];
  gex: UnifiedGEXLandscape;
  basis: BasisState;
  spyImpact: SpyImpactState;
  setups: Setup[];
  regime: RegimeState;
  prediction: PredictionState;
  flow: SPXFlowEvent[];
  coachMessages: CoachMessage[];
  generatedAt: string;
}
