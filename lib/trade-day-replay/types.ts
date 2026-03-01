import type { ClusterZone, FlowEvent, SPXLevel } from '@/lib/types/spx-command-center'

export interface ParsedContract {
  symbol: 'SPX'
  strike: number
  type: 'call' | 'put'
  expiry: string
}

export interface ParsedExitEvent {
  type: 'trim' | 'stop' | 'trail_stop' | 'breakeven_stop' | 'full_exit'
  percentage?: number
  timestamp: string
}

export interface ParsedStopLevel {
  spxLevel: number
  timestamp: string
}

export interface ParsedTrade {
  tradeIndex: number
  contract: ParsedContract
  direction: 'long'
  entryPrice: number
  entryTimestamp: string
  exitEvents: ParsedExitEvent[]
  stopLevels: ParsedStopLevel[]
  spxReferences: number[]
  sizing: 'normal' | 'light' | null
  rawMessages: string[]
}

export interface OptionsContext {
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  iv: number | null
  bid: number | null
  ask: number | null
}

export interface TradeEvaluation {
  alignmentScore: number
  confidence: number
  confidenceTrend: 'up' | 'flat' | 'down'
  expectedValueR: number
  drivers: string[]
  risks: string[]
}

export interface EnrichedTrade extends ParsedTrade {
  optionsAtEntry: OptionsContext | null
  evaluation: TradeEvaluation | null
  pnlPercent: number | null
  isWinner: boolean | null
  holdDurationMin: number | null
}

export interface SessionStats {
  totalTrades: number
  winners: number
  losers: number
  winRate: number
  bestTrade: { index: number; pctReturn: number } | null
  worstTrade: { index: number; pctReturn: number } | null
  sessionStartET: string
  sessionEndET: string
  sessionDurationMin: number
}

export interface ChartBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface PriorDayBar {
  high: number
  low: number
}

export interface ReplayPayload {
  bars: ChartBar[]
  trades: EnrichedTrade[]
  stats: SessionStats
  priorDayBar?: PriorDayBar
}

export interface ReplayAnalyticalSnapshot {
  capturedAt: string
  gexNetGamma: number | null
  gexCallWall: number | null
  gexPutWall: number | null
  gexFlipPoint: number | null
  gexKeyLevels: Array<{ strike: number; gex: number; type: string }> | null
  gexExpiryBreakdown: Record<string, { netGex: number; callWall: number; putWall: number }> | null
  flowBias5m: 'bullish' | 'bearish' | 'neutral' | null
  flowBias15m: 'bullish' | 'bearish' | 'neutral' | null
  flowBias30m: 'bullish' | 'bearish' | 'neutral' | null
  flowEventCount: number
  flowSweepCount: number
  flowBullishPremium: number
  flowBearishPremium: number
  flowEvents: FlowEvent[] | null
  regime: 'trending' | 'ranging' | 'compression' | 'breakout' | null
  regimeDirection: 'bullish' | 'bearish' | null
  regimeProbability: number | null
  regimeConfidence: number | null
  mtf1hTrend: 'up' | 'down' | 'flat' | null
  mtf15mTrend: 'up' | 'down' | 'flat' | null
  mtf5mTrend: 'up' | 'down' | 'flat' | null
  mtf1mTrend: 'up' | 'down' | 'flat' | null
  mtfComposite: number | null
  mtfAligned: boolean | null
  vixValue: number | null
  vixRegime: 'normal' | 'elevated' | 'extreme' | null
  envGatePassed: boolean | null
  envGateReasons: string[]
  macroNextEvent: { event: string; at: string; minutesUntil: number } | null
  sessionMinuteEt: number | null
  levels: SPXLevel[] | null
  clusterZones: ClusterZone[] | null
  basisValue: number | null
  spxPrice: number | null
  spyPrice: number | null
  rrRatio: number | null
  evR: number | null
  memoryEdge: {
    setupType: string | null
    testCount: number | null
    winRate: number | null
    holdRate: number | null
    confidence: number | null
    score: number | null
  } | null
}

export interface ReplayDiscordMessage {
  id: string
  authorName: string
  content: string
  sentAt: string
  isSignal: boolean
  signalType: string | null
  parsedTradeId: string | null
}

export interface ReplayDiscordTrade {
  id: string
  tradeIndex: number
  symbol: string
  strike: number
  contractType: 'call' | 'put'
  expiry: string | null
  direction: 'long' | 'short'
  entryPrice: number | null
  entryTimestamp: string | null
  sizing: string | null
  initialStop: number | null
  thesisText: string | null
  entryCondition: string | null
  lifecycleEvents: Array<{
    type: 'trim' | 'stop_adjust' | 'trail' | 'breakeven' | 'exit'
    value: number | null
    timestamp: string
    messageRef: string | null
  }>
  finalPnlPct: number | null
  isWinner: boolean | null
  fullyExited: boolean
  exitTimestamp: string | null
  entrySnapshot: ReplayAnalyticalSnapshot | null
}

export interface EnrichedReplayPayload extends ReplayPayload {
  snapshots: ReplayAnalyticalSnapshot[]
  discordMessages: ReplayDiscordMessage[] | null
  discordTrades: ReplayDiscordTrade[] | null
  callerName: string | null
  sessionSummary: string | null
  symbolProfile: {
    symbol: string
    displayName: string
    massiveTicker: string
  } | null
}
