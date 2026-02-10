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
  stop_loss: number | null
  initial_target: number | null
  strategy: string | null
  hold_duration_min: number | null
  mfe_percent: number | null
  mae_percent: number | null
  contract_type: 'stock' | 'call' | 'put' | null
  strike_price: number | null
  expiration_date: string | null
  dte_at_entry: number | null
  dte_at_exit: number | null
  iv_at_entry: number | null
  iv_at_exit: number | null
  delta_at_entry: number | null
  theta_at_entry: number | null
  gamma_at_entry: number | null
  vega_at_entry: number | null
  underlying_at_entry: number | null
  underlying_at_exit: number | null
  mood_before: 'confident' | 'neutral' | 'anxious' | 'frustrated' | 'excited' | 'fearful' | null
  mood_after: 'confident' | 'neutral' | 'anxious' | 'frustrated' | 'excited' | 'fearful' | null
  discipline_score: number | null
  followed_plan: boolean | null
  deviation_notes: string | null
  session_id: string | null
  draft_status: 'pending' | 'confirmed' | 'dismissed' | null
  is_draft: boolean
  draft_expires_at: string | null
  is_open: boolean
  enriched_at: string | null
  share_count: number
  is_favorite: boolean
  created_at: string
  updated_at: string
  sync_status?: 'synced' | 'pending_offline'
  offline_queue_id?: string | null
}

export interface JournalFilters {
  dateRange: {
    from: string | null
    to: string | null
    preset: 'today' | 'this-week' | 'this-month' | 'last-month' | '3-months' | 'ytd' | 'all' | 'custom'
  }
  symbol: string | null
  direction: 'long' | 'short' | 'all'
  contractType: 'all' | 'stock' | 'call' | 'put'
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
  contractType: 'all',
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
  direction?: 'long' | 'short' | 'neutral' | null
  stopLoss?: number | null
  initialTarget?: number | null
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

export interface AdvancedAnalyticsResponse {
  period: '7d' | '30d' | '90d' | '1y'
  period_start: string
  total_trades: number
  closed_trades: number
  winning_trades: number
  losing_trades: number
  win_rate: number
  total_pnl: number
  avg_pnl: number
  expectancy: number
  profit_factor: number | null
  avg_r_multiple: number
  sharpe_ratio: number
  sortino_ratio: number
  max_drawdown: number
  max_drawdown_duration_days: number
  avg_hold_minutes: number
  avg_mfe_percent: number
  avg_mae_percent: number
  hourly_pnl: Array<{ hour_of_day: number; pnl: number; trade_count: number }>
  day_of_week_pnl: Array<{ day_of_week: number; pnl: number; trade_count: number }>
  monthly_pnl: Array<{ month: string; pnl: number; trade_count: number }>
  symbol_stats: Array<{ symbol: string; pnl: number; trade_count: number; win_rate: number }>
  direction_stats: Array<{ direction: string; pnl: number; trade_count: number; win_rate: number }>
  dte_buckets: Array<{ bucket: string; pnl: number; trade_count: number; win_rate: number }>
  equity_curve?: Array<{ trade_date: string; equity: number; drawdown: number }>
  r_multiple_distribution?: Array<{ bucket: string; count: number }>
  mfe_mae_scatter?: Array<{ id: string; mfe: number; mae: number; pnl: number }>
}
