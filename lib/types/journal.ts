/**
 * Journal Types — shared between components and API routes
 */

export interface JournalEntry {
  id: string
  user_id: string
  trade_date: string
  symbol: string
  direction: 'long' | 'short' | 'neutral' | null
  entry_price: number | null
  exit_price: number | null
  position_size: number | null
  pnl: number | null
  pnl_percentage: number | null
  is_winner: boolean | null
  screenshot_url: string | null
  screenshot_storage_path: string | null
  ai_analysis: AITradeAnalysis | null
  setup_notes: string | null
  execution_notes: string | null
  lessons_learned: string | null
  tags: string[]
  smart_tags: string[]
  rating: number | null
  market_context: MarketContextSnapshot | null
  verification: TradeVerification | null
  entry_timestamp: string | null
  exit_timestamp: string | null
  is_open: boolean
  enriched_at: string | null
  share_count: number
  created_at: string
  updated_at: string
}

export interface JournalFilters {
  dateRange: {
    from: string | null
    to: string | null
    preset: 'today' | 'this-week' | 'this-month' | 'last-month' | '3-months' | 'ytd' | 'all' | 'custom'
  }
  symbol: string | null
  direction: 'long' | 'short' | 'all'
  pnlFilter: 'winners' | 'losers' | 'all'
  tags: string[]
  aiGrade: string[] | null
  sortBy: 'date-desc' | 'date-asc' | 'pnl-desc' | 'pnl-asc' | 'rating-desc'
  view: 'table' | 'cards'
}

export const DEFAULT_FILTERS: JournalFilters = {
  dateRange: { from: null, to: null, preset: 'all' },
  symbol: null,
  direction: 'all',
  pnlFilter: 'all',
  tags: [],
  aiGrade: null,
  sortBy: 'date-desc',
  view: 'table',
}

export interface JournalStats {
  total_trades: number
  winning_trades: number
  losing_trades: number
  win_rate: number
  total_pnl: number
  avg_pnl: number
  best_trade: number
  worst_trade: number
  profit_factor: number
  avg_win: number
  avg_loss: number
}

export interface AITradeAnalysis {
  summary: string
  grade: string
  trend_analysis?: {
    direction: string
    strength: string
    notes: string
  }
  entry_analysis?: {
    quality: string
    observations: string[]
    improvements: string[]
  }
  exit_analysis?: {
    quality: string
    observations: string[]
    improvements: string[]
  }
  risk_management?: {
    score: number
    observations: string[]
    suggestions: string[]
  }
  coaching_notes?: string
  tags?: string[]
  analyzed_at?: string
  model?: string
}

export interface MarketContextSnapshot {
  entryContext: {
    timestamp: string
    price: number
    vwap: number
    atr14: number
    volumeVsAvg: number
    distanceFromPDH: number
    distanceFromPDL: number
    nearestLevel: {
      name: string
      price: number
      distance: number
    }
  }
  exitContext: {
    timestamp: string
    price: number
    vwap: number
    atr14: number
    volumeVsAvg: number
    distanceFromPDH: number
    distanceFromPDL: number
    nearestLevel: {
      name: string
      price: number
      distance: number
    }
  }
  optionsContext?: {
    ivAtEntry: number
    ivAtExit: number
    ivRankAtEntry: number
    deltaAtEntry: number
    thetaAtEntry: number
    dteAtEntry: number
    dteAtExit: number
  }
  dayContext: {
    marketTrend: 'bullish' | 'bearish' | 'neutral'
    atrUsed: number
    sessionType: 'trending' | 'range-bound' | 'volatile'
    keyLevelsActive: {
      pdh: number
      pdl: number
      pdc: number
      vwap: number
      atr14: number
      pivotPP: number
      pivotR1: number
      pivotS1: number
    }
  }
}

export interface TradeVerification {
  isVerified: boolean
  confidence: 'exact' | 'close' | 'unverifiable'
  entryPriceMatch: boolean
  exitPriceMatch: boolean
  priceSource: string
  verifiedAt: string
}

export interface TradeReplayData {
  entryId: string
  symbol: string
  bars: {
    time: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }[]
  entryPoint: { time: number; price: number }
  exitPoint: { time: number; price: number }
  vwapLine: { time: number; value: number }[]
  levels: {
    pdh: number
    pdl: number
    pdc: number
    pivotPP: number
    pivotR1: number
    pivotS1: number
  }
}

export interface SmartTagRule {
  tag: string
  condition: (context: MarketContextSnapshot) => boolean
}
