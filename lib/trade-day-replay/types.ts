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

export interface ReplayPayload {
  bars: ChartBar[]
  trades: EnrichedTrade[]
  stats: SessionStats
}
