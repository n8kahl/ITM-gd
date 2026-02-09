export type AIFieldKey =
  | 'symbol'
  | 'direction'
  | 'entry_price'
  | 'exit_price'
  | 'pnl'
  | 'pnl_percentage'

export type AIFieldStatus = 'pending' | 'accepted'

export interface TradeEntryFormData {
  trade_date: string
  symbol: string
  direction: 'long' | 'short'
  entry_price: string
  exit_price: string
  position_size: string
  pnl: string
  pnl_percentage: string
  screenshot_url: string
  notes: string
  tags: string[]
  rating: number
}
