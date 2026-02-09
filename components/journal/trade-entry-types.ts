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
  contract_type: 'stock' | 'call' | 'put' | 'spread'
  strike_price: string
  expiration_date: string
  dte_at_entry: string
  dte_at_exit: string
  iv_at_entry: string
  iv_at_exit: string
  delta_at_entry: string
  theta_at_entry: string
  gamma_at_entry: string
  vega_at_entry: string
  underlying_at_entry: string
  underlying_at_exit: string
  entry_price: string
  exit_price: string
  position_size: string
  stop_loss: string
  initial_target: string
  strategy: string
  mood_before: '' | 'confident' | 'neutral' | 'anxious' | 'frustrated' | 'excited' | 'fearful'
  mood_after: '' | 'confident' | 'neutral' | 'anxious' | 'frustrated' | 'excited' | 'fearful'
  discipline_score: string
  followed_plan: '' | 'yes' | 'no'
  deviation_notes: string
  pnl: string
  pnl_percentage: string
  screenshot_url: string
  notes: string
  tags: string[]
  rating: number
}
