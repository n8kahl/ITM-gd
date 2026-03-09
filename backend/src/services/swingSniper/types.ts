export type SwingSniperDirection = 'long_vol' | 'short_vol' | 'neutral';

export type SwingSniperNarrativeMomentum = 'positive' | 'negative' | 'mixed' | 'quiet';

export type SwingSniperEdgeState = 'improving' | 'stable' | 'narrowing' | 'invalidated';

export type SwingSniperMonitoringStatus = 'forming' | 'active' | 'degrading' | 'invalidated' | 'closed';

export type SwingSniperExitBias = 'hold' | 'trim' | 'take_profit' | 'close' | 'roll';

export interface SwingSniperOpportunity {
  symbol: string;
  score: number;
  direction: SwingSniperDirection;
  setupLabel: string;
  thesis: string;
  currentPrice: number | null;
  currentIV: number | null;
  realizedVol20: number | null;
  ivRank: number | null;
  ivPercentile: number | null;
  ivVsRvGap: number | null;
  skewDirection: 'put_heavy' | 'call_heavy' | 'balanced' | 'unknown';
  termStructureShape: 'contango' | 'backwardation' | 'flat';
  catalystLabel: string;
  catalystDate: string | null;
  catalystDaysUntil: number | null;
  catalystDensity: number;
  narrativeMomentum: SwingSniperNarrativeMomentum;
  expressionPreview: string;
  reasons: string[];
  saved: boolean;
  asOf: string;
}

export interface SwingSniperUniverseResponse {
  generatedAt: string;
  universeSize: number;
  symbolsScanned: number;
  opportunities: SwingSniperOpportunity[];
  notes: string[];
}

export interface SwingSniperVolOverlayPoint {
  date: string;
  label: string;
  iv: number | null;
  rv: number | null;
}

export interface SwingSniperTermStructureBar {
  date: string;
  dte: number;
  atmIV: number;
}

export interface SwingSniperCatalystEvent {
  id: string;
  type: 'earnings' | 'macro' | 'news';
  title: string;
  date: string;
  daysUntil: number;
  impact: 'high' | 'medium' | 'low';
  summary: string;
  timing?: string | null;
  expectedMovePct?: number | null;
  url?: string | null;
}

export interface SwingSniperCatalystDensityPoint {
  date: string;
  label: string;
  count: number;
  emphasis: 'high' | 'medium' | 'low';
}

export type SwingSniperStructureStrategy =
  | 'long_call'
  | 'long_put'
  | 'call_debit_spread'
  | 'put_debit_spread'
  | 'call_credit_spread'
  | 'put_credit_spread'
  | 'long_straddle'
  | 'long_strangle'
  | 'call_calendar'
  | 'put_calendar'
  | 'call_diagonal'
  | 'put_diagonal'
  | 'call_butterfly'
  | 'put_butterfly';

export interface SwingSniperStructureLeg {
  leg: string;
  side: 'buy' | 'sell';
  optionType: 'call' | 'put';
  expiry: string;
  strike: number;
  quantity: number;
  mark: number | null;
  bid: number | null;
  ask: number | null;
  spreadPct: number | null;
  delta: number | null;
  openInterest: number | null;
  volume: number | null;
}

export interface SwingSniperPayoffPoint {
  price: number;
  pnl: number;
  returnPct: number | null;
}

export interface SwingSniperPayoffDistributionBucket {
  label: string;
  probability: number;
  expectedPnl: number;
  expectedReturnPct: number | null;
}

export interface SwingSniperStructureRecommendation {
  id: string;
  strategy: SwingSniperStructureStrategy;
  strategyLabel: string;
  thesisFit: number;
  debitOrCredit: 'debit' | 'credit';
  netPremium: number | null;
  maxLoss: number | null;
  maxProfit: number | null;
  breakevenLow: number | null;
  breakevenHigh: number | null;
  probabilityOfProfit: number | null;
  entryWindow: string;
  invalidation: string;
  contractSummary: string;
  spreadQuality: 'tight' | 'fair' | 'wide';
  liquidityScore: number | null;
  contracts: SwingSniperStructureLeg[];
  whyThisStructure: string[];
  risks: string[];
  scenarioSummary: {
    bearCase: string;
    baseCase: string;
    bullCase: string;
  };
  payoffDiagram: SwingSniperPayoffPoint[];
  payoffDistribution: SwingSniperPayoffDistributionBucket[];
}

export interface SwingSniperStructureLabResponse {
  generatedAt: string;
  symbol: string;
  direction: SwingSniperDirection;
  recommendations: SwingSniperStructureRecommendation[];
  notes: string[];
}

export interface SwingSniperMonitoringSnapshot {
  status: SwingSniperMonitoringStatus;
  healthScore: number;
  primaryRisk: string | null;
  exitBias: SwingSniperExitBias;
  note: string;
}

export interface SwingSniperSavedThesisMonitoringSnapshot extends SwingSniperSavedThesisSnapshot {
  monitoring: SwingSniperMonitoringSnapshot;
  currentPrice: number | null;
}

export interface SwingSniperMonitoringAlert {
  id: string;
  source: 'thesis' | 'position';
  symbol: string | null;
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  suggestedAction: string | null;
}

export interface SwingSniperMonitoringPositionAdvice {
  positionId: string;
  symbol: string;
  severity: 'low' | 'medium' | 'high';
  type: 'take_profit' | 'stop_loss' | 'time_decay';
  message: string;
  suggestedAction: string;
}

export interface SwingSniperPortfolioSymbolExposure {
  symbol: string;
  positionCount: number;
  pnl: number;
  pnlPct: number;
  netDelta: number;
  netTheta: number;
}

export interface SwingSniperPortfolioExposureSummary {
  openPositions: number;
  totalPnl: number;
  totalPnlPct: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'extreme';
  warnings: string[];
  netGreeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
  };
  symbolExposure: SwingSniperPortfolioSymbolExposure[];
}

export interface SwingSniperMonitoringResponse {
  generatedAt: string;
  savedTheses: SwingSniperSavedThesisMonitoringSnapshot[];
  portfolio: SwingSniperPortfolioExposureSummary;
  positionAdvice: SwingSniperMonitoringPositionAdvice[];
  alerts: SwingSniperMonitoringAlert[];
  notes: string[];
}

export interface SwingSniperDossierResponse {
  symbol: string;
  companyName: string | null;
  currentPrice: number | null;
  score: number | null;
  direction: SwingSniperDirection;
  setupLabel: string;
  expressionPreview: string;
  thesis: string;
  summary: string;
  saved: boolean;
  asOf: string;
  reasoning: string[];
  keyStats: Array<{
    label: string;
    value: string;
    tone?: 'positive' | 'negative' | 'neutral';
  }>;
  volMap: {
    overlayMode: 'current_iv_benchmark';
    overlayPoints: SwingSniperVolOverlayPoint[];
    currentIV: number | null;
    realizedVol10: number | null;
    realizedVol20: number | null;
    realizedVol30: number | null;
    ivRank: number | null;
    ivPercentile: number | null;
    skewDirection: 'put_heavy' | 'call_heavy' | 'balanced' | 'unknown';
    termStructureShape: 'contango' | 'backwardation' | 'flat';
    termStructure: SwingSniperTermStructureBar[];
    note: string;
  };
  catalysts: {
    densityStrip: SwingSniperCatalystDensityPoint[];
    events: SwingSniperCatalystEvent[];
    narrative: string;
  };
  risk: {
    invalidation: string[];
    watchItems: string[];
    notes: string[];
  };
  news: Array<{
    id: string;
    title: string;
    publishedAt: string;
    publisher: string;
    summary: string | null;
    url: string;
  }>;
  structureLab: SwingSniperStructureLabResponse;
}

export interface SwingSniperSavedThesisSnapshot {
  symbol: string;
  savedAt: string;
  score: number | null;
  setupLabel: string;
  direction: SwingSniperDirection;
  thesis: string;
  ivRankAtSave: number | null;
  ivRankNow: number | null;
  edgeState: SwingSniperEdgeState;
  monitorNote: string;
}

export interface SwingSniperBriefResponse {
  generatedAt: string;
  regime: {
    label: string;
    description: string;
    signals: string[];
  };
  memo: string;
  actionQueue: string[];
  savedTheses: SwingSniperSavedThesisSnapshot[];
}

export interface SwingSniperWatchlistFilters {
  preset: 'all' | 'long_vol' | 'short_vol' | 'catalyst_dense';
  minScore: number;
}

export interface SwingSniperSavedThesisRecord {
  symbol: string;
  savedAt: string;
  score: number | null;
  setupLabel: string;
  direction: SwingSniperDirection;
  thesis: string;
  ivRankAtSave: number | null;
  catalystLabel: string | null;
  catalystDate: string | null;
  monitorNote: string;
}

export interface SwingSniperWatchlistState {
  symbols: string[];
  selectedSymbol: string | null;
  filters: SwingSniperWatchlistFilters;
  savedTheses: SwingSniperSavedThesisRecord[];
}

export interface SwingSniperWatchlistUpdateInput {
  symbols?: string[];
  selectedSymbol?: string | null;
  filters?: Partial<SwingSniperWatchlistFilters>;
  thesis?: {
    symbol: string;
    score: number | null;
    setupLabel: string;
    direction: SwingSniperDirection;
    thesis: string;
    ivRankAtSave: number | null;
    catalystLabel?: string | null;
    catalystDate?: string | null;
    monitorNote?: string | null;
  };
}

export type SwingSniperSignalSnapshotSource = 'universe' | 'dossier' | 'manual';

export interface SwingSniperSignalSnapshotRecord {
  symbol: string;
  asOf: string;
  asOfDate: string;
  capturedFrom: SwingSniperSignalSnapshotSource;
  score: number | null;
  direction: SwingSniperDirection;
  setupLabel: string | null;
  thesis: string | null;
  currentPrice: number | null;
  currentIV: number | null;
  realizedVol20: number | null;
  ivRank: number | null;
  ivPercentile: number | null;
  ivVsRvGap: number | null;
  catalystDate: string | null;
  catalystDaysUntil: number | null;
  snapshot: Record<string, unknown>;
  createdAt: string;
}

export interface SwingSniperSignalSnapshotInput {
  symbol: string;
  asOf: string;
  capturedFrom: SwingSniperSignalSnapshotSource;
  score: number | null;
  direction: SwingSniperDirection;
  setupLabel?: string | null;
  thesis?: string | null;
  currentPrice?: number | null;
  currentIV?: number | null;
  realizedVol20?: number | null;
  ivRank?: number | null;
  ivPercentile?: number | null;
  ivVsRvGap?: number | null;
  catalystDate?: string | null;
  catalystDaysUntil?: number | null;
  snapshot?: Record<string, unknown>;
}

export interface SwingSniperBacktestOutcome {
  snapshotDate: string;
  direction: SwingSniperDirection;
  entryPrice: number;
  exitPrice: number;
  horizonDays: number;
  movePct: number;
  absoluteMovePct: number;
  thresholdPct: number;
  success: boolean;
  weight: number;
}

export interface SwingSniperBacktestSummary {
  sampleSize: number;
  resolvedSamples: number;
  hitRatePct: number | null;
  weightedHitRatePct: number | null;
  averageMovePct: number | null;
  medianMovePct: number | null;
  bestMovePct: number | null;
  worstMovePct: number | null;
  averageHorizonDays: number | null;
}

export interface SwingSniperConfidenceOverlay {
  confidenceWeight: number;
  baseScore: number | null;
  adjustedScore: number | null;
  stance: 'boost' | 'neutral' | 'trim';
  rationale: string[];
}

export interface SwingSniperBacktestResponse {
  generatedAt: string;
  symbol: string;
  status: 'ready' | 'limited' | 'unavailable';
  windowDays: number;
  snapshotsConsidered: number;
  summary: SwingSniperBacktestSummary;
  confidence: SwingSniperConfidenceOverlay;
  outcomes: SwingSniperBacktestOutcome[];
  caveats: string[];
  notes: string[];
}

export interface SwingSniperVolBenchmark {
  rv10: number | null;
  rv20: number | null;
  rv30: number | null;
  overlayBase: Array<{
    date: string;
    label: string;
    rv: number | null;
  }>;
}
