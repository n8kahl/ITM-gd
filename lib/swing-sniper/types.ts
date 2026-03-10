export type SwingSniperDirection = 'long_vol' | 'short_vol' | 'neutral'

export type SwingSniperEdgeState = 'improving' | 'stable' | 'narrowing' | 'invalidated'

export type SwingSniperMonitoringStatus = 'forming' | 'active' | 'degrading' | 'invalidated' | 'closed'

export type SwingSniperExitBias = 'hold' | 'trim' | 'take_profit' | 'close' | 'roll'

export type SwingSniperRiskMode = 'defined_risk_only' | 'naked_allowed'

export type SwingSniperSwingWindow = 'seven_to_fourteen' | 'fourteen_to_thirty' | 'all'

export type SwingSniperStructureStrategy =
  | 'long_call'
  | 'long_put'
  | 'long_straddle'
  | 'long_strangle'
  | 'call_debit_spread'
  | 'put_debit_spread'
  | 'call_calendar'
  | 'put_calendar'
  | 'call_diagonal'
  | 'put_diagonal'
  | 'call_butterfly'
  | 'put_butterfly'

export interface SwingSniperBoardIdea {
  symbol: string
  orc_score: number
  view: 'Long vol' | 'Short vol' | 'Neutral'
  catalyst_label: string
  window_days: number | null
  blurb: string
  factors: {
    volatility: number
    catalyst: number
    liquidity: number
  }
}

export interface SwingSniperBoardPayload {
  generated_at: string
  regime?: {
    label: string
    market_posture: string
    bias: string
  }
  ideas: SwingSniperBoardIdea[]
}

export interface SwingSniperMemoPayload {
  generated_at: string
  regime?: {
    label: string
    market_posture: string
  }
  desk_note: string
  themes: string[]
  saved_theses: Array<{
    symbol: string
    label: string
    saved_at: string
  }>
  action_queue?: string[]
}

export interface SwingSniperDossierStructureContract {
  name: string
  fit_score: number
  rationale: string
  entry_type: string
  max_loss: string
  pop: string
  style: string
  contracts: Array<{
    leg: string
    side: 'buy' | 'sell'
    optionType: 'call' | 'put'
    expiry: string
    strike: number
    quantity: number
    mark: number | null
    bid: number | null
    ask: number | null
    spreadPct: number | null
    delta: number | null
    openInterest: number | null
    volume: number | null
  }> | null
  scenario_distribution: Array<{
    label: string
    probability: number
    expectedPnl: number
    expectedReturnPct: number | null
  }> | null
  payoff_diagram: Array<{
    price: number
    pnl: number
    returnPct: number | null
  }> | null
}

export interface SwingSniperDossierPayload {
  symbol: string
  orc_score: number
  view: 'Long vol' | 'Short vol' | 'Neutral'
  catalyst_label: string
  headline: string
  thesis: {
    summary: string
    risks: string[]
    narrative_shifts: string[]
    factors: {
      volatility: number
      catalyst: number
      liquidity: number
    }
  }
  vol_map: {
    surface_read: string
    iv_rank: number | null
    iv_percentile: number | null
    rv_20d: number | null
    iv_now: number | null
    skew: string
    term_shape: string
    term_structure: Array<{
      label: string
      iv: number
    }>
    iv_rv_history: Array<{
      date: string
      iv: number | null
      rv: number | null
    }>
  }
  catalysts: Array<{
    days_out: number
    date: string
    label: string
    context: string
    severity: 'high' | 'medium' | 'low'
  }>
  structures: SwingSniperDossierStructureContract[]
  risk: {
    killers: string[]
    exit_framework: string
  }
}

export interface SwingSniperMonitoringSnapshot {
  status: SwingSniperMonitoringStatus
  healthScore: number
  primaryRisk: string | null
  exitBias: SwingSniperExitBias
  note: string
}

export interface SwingSniperSavedThesisMonitoringSnapshot {
  symbol: string
  savedAt: string
  score: number | null
  setupLabel: string
  direction: SwingSniperDirection
  thesis: string
  ivRankAtSave: number | null
  ivRankNow: number | null
  edgeState: SwingSniperEdgeState
  monitorNote: string
  monitoring: SwingSniperMonitoringSnapshot
  currentPrice: number | null
}

export interface SwingSniperMonitoringPayload {
  generatedAt: string
  cadence?: {
    mode: 'on_demand_cached'
    refreshIntervalMinutes: number
    nextEvaluationAt: string
  }
  savedTheses: SwingSniperSavedThesisMonitoringSnapshot[]
  portfolio: {
    openPositions: number
    totalPnl: number
    totalPnlPct: number
    riskLevel: 'low' | 'moderate' | 'high' | 'extreme'
    warnings: string[]
    netGreeks: {
      delta: number
      gamma: number
      theta: number
      vega: number
      rho: number
    }
    symbolExposure: Array<{
      symbol: string
      positionCount: number
      pnl: number
      pnlPct: number
      netDelta: number
      netTheta: number
    }>
  }
  positionAdvice: Array<{
    positionId: string
    symbol: string
    severity: 'low' | 'medium' | 'high'
    type: 'take_profit' | 'stop_loss' | 'time_decay'
    message: string
    suggestedAction: string
  }>
  alerts: Array<{
    id: string
    source: 'thesis' | 'position'
    symbol: string | null
    severity: 'low' | 'medium' | 'high'
    title: string
    message: string
    suggestedAction: string | null
  }>
  notes: string[]
}

export interface SwingSniperWatchlistPayload {
  symbols: string[]
  selectedSymbol: string | null
  filters: {
    preset: 'all' | 'long_vol' | 'short_vol' | 'catalyst_dense' | 'seven_day'
    minScore: number
    riskMode: SwingSniperRiskMode
    swingWindow: SwingSniperSwingWindow
    preferredSetups: SwingSniperStructureStrategy[]
  }
  savedTheses: Array<{
    symbol: string
    savedAt: string
    score: number | null
    setupLabel: string
    direction: SwingSniperDirection
    thesis: string
    ivRankAtSave: number | null
    catalystLabel: string | null
    catalystDate: string | null
    monitorNote: string
  }>
}

export interface SwingSniperWatchlistSavePayload {
  selectedSymbol?: string | null
  symbols?: string[]
  filters?: Partial<SwingSniperWatchlistPayload['filters']>
  removeThesisSymbol?: string | null
  thesis?: {
    symbol: string
    score: number | null
    setupLabel: string
    direction: SwingSniperDirection
    thesis: string
    ivRankAtSave: number | null
    catalystLabel?: string | null
    catalystDate?: string | null
    monitorNote?: string | null
  }
}

export interface SwingSniperBacktestOutcome {
  snapshotDate: string
  direction: SwingSniperDirection
  entryPrice: number
  exitPrice: number
  horizonDays: number
  movePct: number
  absoluteMovePct: number
  thresholdPct: number
  success: boolean
  weight: number
}

export interface SwingSniperBacktestPayload {
  generatedAt: string
  symbol: string
  status: 'ready' | 'limited' | 'unavailable'
  windowDays: number
  snapshotsConsidered: number
  summary: {
    sampleSize: number
    resolvedSamples: number
    hitRatePct: number | null
    weightedHitRatePct: number | null
    averageMovePct: number | null
    medianMovePct: number | null
    bestMovePct: number | null
    worstMovePct: number | null
    averageHorizonDays: number | null
  }
  confidence: {
    confidenceWeight: number
    baseScore: number | null
    adjustedScore: number | null
    stance: 'boost' | 'neutral' | 'trim'
    rationale: string[]
  }
  outcomes: SwingSniperBacktestOutcome[]
  caveats: string[]
  notes: string[]
}
