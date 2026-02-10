export type JournalDirection = 'long' | 'short'

export type JournalContractType = 'stock' | 'call' | 'put'

export type JournalMood = 'confident' | 'neutral' | 'anxious' | 'frustrated' | 'excited' | 'fearful'

export interface AITradeAnalysis {
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  entry_quality: string
  exit_quality: string
  risk_management: string
  lessons: string[]
  scored_at: string
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

export interface JournalEntry {
  id: string
  user_id: string

  trade_date: string
  symbol: string
  direction: JournalDirection
  contract_type: JournalContractType
  entry_price: number | null
  exit_price: number | null
  position_size: number | null
  pnl: number | null
  pnl_percentage: number | null
  is_winner: boolean | null
  is_open: boolean

  entry_timestamp: string | null
  exit_timestamp: string | null

  stop_loss: number | null
  initial_target: number | null
  hold_duration_min: number | null
  mfe_percent: number | null
  mae_percent: number | null

  strike_price: number | null
  expiration_date: string | null
  dte_at_entry: number | null
  iv_at_entry: number | null
  delta_at_entry: number | null
  theta_at_entry: number | null
  gamma_at_entry: number | null
  vega_at_entry: number | null
  underlying_at_entry: number | null
  underlying_at_exit: number | null

  mood_before: JournalMood | null
  mood_after: JournalMood | null
  discipline_score: number | null
  followed_plan: boolean | null
  deviation_notes: string | null

  strategy: string | null
  setup_notes: string | null
  execution_notes: string | null
  lessons_learned: string | null
  tags: string[]
  rating: number | null

  screenshot_url: string | null
  screenshot_storage_path: string | null

  ai_analysis: AITradeAnalysis | null

  market_context: MarketContextSnapshot | null

  import_id: string | null

  is_favorite: boolean

  created_at: string
  updated_at: string
}

export interface AdvancedAnalyticsResponse {
  period: '7d' | '30d' | '90d' | '1y' | 'all'
  period_start: string
  total_trades: number
  winning_trades: number
  losing_trades: number
  win_rate: number | null
  total_pnl: number
  avg_pnl: number | null
  expectancy: number | null
  profit_factor: number | null
  sharpe_ratio: number | null
  sortino_ratio: number | null
  max_drawdown: number
  max_drawdown_duration_days: number
  avg_hold_minutes: number | null
  hourly_pnl: { hour: number, pnl: number, count: number }[]
  day_of_week_pnl: { day: number, pnl: number, count: number }[]
  monthly_pnl: { month: string, pnl: number, count: number }[]
  symbol_stats: { symbol: string, pnl: number, count: number, win_rate: number }[]
  direction_stats: { direction: string, pnl: number, count: number, win_rate: number }[]
  equity_curve: { date: string, equity: number, drawdown: number }[]
  r_multiple_distribution: { bucket: string, count: number }[]
  mfe_mae_scatter: { id: string, mfe: number, mae: number, pnl: number }[]
}

export type JournalFilters = {
  startDate: string | null
  endDate: string | null
  symbol: string
  direction: JournalDirection | 'all'
  contractType: JournalContractType | 'all'
  isWinner: 'all' | 'true' | 'false'
  isOpen: 'all' | 'true' | 'false'
  tags: string[]
  sortBy: 'trade_date' | 'pnl' | 'symbol'
  sortDir: 'asc' | 'desc'
  limit: number
  offset: number
  view: 'table' | 'cards'
}

export const DEFAULT_JOURNAL_FILTERS: JournalFilters = {
  startDate: null,
  endDate: null,
  symbol: '',
  direction: 'all',
  contractType: 'all',
  isWinner: 'all',
  isOpen: 'all',
  tags: [],
  sortBy: 'trade_date',
  sortDir: 'desc',
  limit: 100,
  offset: 0,
  view: 'table',
}

export type JournalStats = {
  totalTrades: number
  winRate: number | null
  totalPnl: number | null
  profitFactor: number | null
}
