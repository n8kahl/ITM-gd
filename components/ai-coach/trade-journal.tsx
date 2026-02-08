'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  BarChart3,
  X,
  FileUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  getTrades,
  createTrade,
  deleteTrade,
  getTradeAnalytics,
  AICoachAPIError,
  type TradeEntry,
  type TradeCreateInput,
  type TradeAnalyticsResponse,
  type PositionType,
  type TradeOutcome,
} from '@/lib/api/ai-coach'

// ============================================
// TYPES
// ============================================

type JournalTab = 'trades' | 'add' | 'analytics'

interface TradeJournalProps {
  onClose: () => void
}

// ============================================
// CONSTANTS
// ============================================

const POSITION_TYPES: { value: PositionType; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'put', label: 'Put' },
  { value: 'call_spread', label: 'Call Spread' },
  { value: 'put_spread', label: 'Put Spread' },
  { value: 'iron_condor', label: 'Iron Condor' },
  { value: 'stock', label: 'Stock' },
]

const STRATEGIES = [
  '0DTE Scalp',
  'Credit Spread',
  'Debit Spread',
  'Iron Condor',
  'LEAPS',
  'Swing Trade',
  'Day Trade',
  'Momentum',
  'Mean Reversion',
  'Other',
]

// ============================================
// COMPONENT
// ============================================

export function TradeJournal({ onClose }: TradeJournalProps) {
  const { session } = useMemberAuth()
  const [activeTab, setActiveTab] = useState<JournalTab>('trades')
  const [trades, setTrades] = useState<TradeEntry[]>([])
  const [analytics, setAnalytics] = useState<TradeAnalyticsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterOutcome, setFilterOutcome] = useState<TradeOutcome | ''>('')

  const token = session?.access_token

  // Fetch trades
  const fetchTrades = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)

    try {
      const result = await getTrades(token, {
        limit: 50,
        outcome: filterOutcome || undefined,
      })
      setTrades(result.trades)
    } catch (err) {
      const msg = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to load trades'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [token, filterOutcome])

  // Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    if (!token) return
    try {
      const data = await getTradeAnalytics(token)
      setAnalytics(data)
    } catch {
      // Silent fail - analytics are secondary
    }
  }, [token])

  useEffect(() => {
    fetchTrades()
    fetchAnalytics()
  }, [fetchTrades, fetchAnalytics])

  const handleDeleteTrade = useCallback(async (id: string) => {
    if (!token) return
    try {
      await deleteTrade(id, token)
      setTrades(prev => prev.filter(t => t.id !== id))
    } catch {
      // Silent
    }
  }, [token])

  const handleTradeCreated = useCallback(() => {
    setActiveTab('trades')
    fetchTrades()
    fetchAnalytics()
  }, [fetchTrades, fetchAnalytics])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-medium text-white">Trade Journal</h2>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="border-b border-white/5 px-2 flex items-center gap-1">
        {([
          { key: 'trades' as JournalTab, label: 'Trades', icon: BookOpen },
          { key: 'add' as JournalTab, label: 'Add Trade', icon: Plus },
          { key: 'analytics' as JournalTab, label: 'Analytics', icon: BarChart3 },
        ]).map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all border-b-2',
                activeTab === tab.key
                  ? 'text-emerald-400 border-emerald-500'
                  : 'text-white/40 hover:text-white/60 border-transparent'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'trades' && (
          <TradesList
            trades={trades}
            isLoading={isLoading}
            error={error}
            filterOutcome={filterOutcome}
            onFilterChange={setFilterOutcome}
            onDelete={handleDeleteTrade}
            onRetry={fetchTrades}
          />
        )}

        {activeTab === 'add' && (
          <TradeForm
            token={token}
            onCreated={handleTradeCreated}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard analytics={analytics} />
        )}
      </div>
    </div>
  )
}

// ============================================
// TRADES LIST
// ============================================

function TradesList({
  trades,
  isLoading,
  error,
  filterOutcome,
  onFilterChange,
  onDelete,
  onRetry,
}: {
  trades: TradeEntry[]
  isLoading: boolean
  error: string | null
  filterOutcome: TradeOutcome | ''
  onFilterChange: (o: TradeOutcome | '') => void
  onDelete: (id: string) => void
  onRetry: () => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-red-400 mb-2">{error}</p>
        <button onClick={onRetry} className="text-xs text-emerald-500 hover:text-emerald-400">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/40">Filter:</span>
        {(['', 'win', 'loss', 'breakeven'] as const).map(outcome => (
          <button
            key={outcome || 'all'}
            onClick={() => onFilterChange(outcome)}
            className={cn(
              'text-xs px-2 py-1 rounded transition-colors',
              filterOutcome === outcome
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-white/40 hover:text-white/60'
            )}
          >
            {outcome === '' ? 'All' : outcome.charAt(0).toUpperCase() + outcome.slice(1)}
          </button>
        ))}
      </div>

      {trades.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-8 h-8 text-white/10 mx-auto mb-3" />
          <p className="text-sm text-white/40">No trades recorded yet</p>
          <p className="text-xs text-white/25 mt-1">Add your first trade to start tracking performance</p>
        </div>
      ) : (
        trades.map(trade => (
          <div
            key={trade.id}
            className="glass-card-heavy rounded-lg border border-white/5 overflow-hidden"
          >
            <button
              onClick={() => setExpandedId(expandedId === trade.id ? null : trade.id)}
              className="w-full p-3 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <OutcomeIcon outcome={trade.trade_outcome} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{trade.symbol}</span>
                    <span className="text-xs text-white/30 capitalize">
                      {trade.position_type.replace('_', ' ')}
                    </span>
                    {trade.strategy && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">
                        {trade.strategy}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-white/30">
                    {new Date(trade.entry_date).toLocaleDateString()}
                    {trade.exit_date && ` — ${new Date(trade.exit_date).toLocaleDateString()}`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {trade.pnl != null && (
                  <span className={cn(
                    'text-sm font-medium',
                    trade.pnl > 0 ? 'text-emerald-400' : trade.pnl < 0 ? 'text-red-400' : 'text-white/50'
                  )}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                  </span>
                )}
                {expandedId === trade.id ? (
                  <ChevronUp className="w-4 h-4 text-white/30" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/30" />
                )}
              </div>
            </button>

            {expandedId === trade.id && (
              <div className="px-3 pb-3 border-t border-white/5 pt-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-white/30">Entry Price:</span>
                    <span className="text-white/70 ml-1">${trade.entry_price.toFixed(2)}</span>
                  </div>
                  {trade.exit_price != null && (
                    <div>
                      <span className="text-white/30">Exit Price:</span>
                      <span className="text-white/70 ml-1">${trade.exit_price.toFixed(2)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-white/30">Quantity:</span>
                    <span className="text-white/70 ml-1">{trade.quantity}</span>
                  </div>
                  {trade.pnl_pct != null && (
                    <div>
                      <span className="text-white/30">Return:</span>
                      <span className={cn(
                        'ml-1',
                        trade.pnl_pct >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {trade.pnl_pct >= 0 ? '+' : ''}{trade.pnl_pct.toFixed(1)}%
                      </span>
                    </div>
                  )}
                  {trade.hold_time_days != null && (
                    <div>
                      <span className="text-white/30">Hold Time:</span>
                      <span className="text-white/70 ml-1">{trade.hold_time_days}d</span>
                    </div>
                  )}
                  {trade.exit_reason && (
                    <div className="col-span-2">
                      <span className="text-white/30">Exit Reason:</span>
                      <span className="text-white/70 ml-1">{trade.exit_reason}</span>
                    </div>
                  )}
                  {trade.lessons_learned && (
                    <div className="col-span-2 mt-1 p-2 rounded bg-white/5">
                      <span className="text-white/30 block mb-0.5">Lessons:</span>
                      <span className="text-white/60 text-[11px]">{trade.lessons_learned}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => onDelete(trade.id)}
                    className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// ============================================
// TRADE FORM
// ============================================

function TradeForm({
  token,
  onCreated,
}: {
  token?: string
  onCreated: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [symbol, setSymbol] = useState('')
  const [positionType, setPositionType] = useState<PositionType>('call')
  const [strategy, setStrategy] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [entryPrice, setEntryPrice] = useState('')
  const [exitDate, setExitDate] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [exitReason, setExitReason] = useState('')
  const [lessonsLearned, setLessonsLearned] = useState('')

  const handleSubmit = useCallback(async () => {
    if (!token) return
    if (!symbol.trim() || !entryPrice || !entryDate) {
      setFormError('Symbol, entry price, and entry date are required')
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    const trade: TradeCreateInput = {
      symbol: symbol.toUpperCase(),
      position_type: positionType,
      strategy: strategy || undefined,
      entry_date: entryDate,
      entry_price: parseFloat(entryPrice),
      exit_date: exitDate || undefined,
      exit_price: exitPrice ? parseFloat(exitPrice) : undefined,
      quantity: parseInt(quantity) || 1,
      exit_reason: exitReason || undefined,
      lessons_learned: lessonsLearned || undefined,
    }

    try {
      await createTrade(trade, token)
      onCreated()
    } catch (err) {
      const msg = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to create trade'
      setFormError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }, [token, symbol, positionType, strategy, entryDate, entryPrice, exitDate, exitPrice, quantity, exitReason, lessonsLearned, onCreated])

  return (
    <div className="p-4 space-y-4">
      {formError && (
        <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">{formError}</p>
        </div>
      )}

      {/* Symbol and Type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/40 block mb-1">Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            placeholder="SPX"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1">Type</label>
          <select
            value={positionType}
            onChange={e => setPositionType(e.target.value as PositionType)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
          >
            {POSITION_TYPES.map(pt => (
              <option key={pt.value} value={pt.value} className="bg-[#0a0a0a]">
                {pt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Strategy */}
      <div>
        <label className="text-xs text-white/40 block mb-1">Strategy</label>
        <select
          value={strategy}
          onChange={e => setStrategy(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
        >
          <option value="" className="bg-[#0a0a0a]">Select strategy...</option>
          {STRATEGIES.map(s => (
            <option key={s} value={s} className="bg-[#0a0a0a]">{s}</option>
          ))}
        </select>
      </div>

      {/* Entry */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/40 block mb-1">Entry Date</label>
          <input
            type="date"
            value={entryDate}
            onChange={e => setEntryDate(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1">Entry Price</label>
          <input
            type="number"
            step="0.01"
            value={entryPrice}
            onChange={e => setEntryPrice(e.target.value)}
            placeholder="0.00"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Exit */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/40 block mb-1">Exit Date</label>
          <input
            type="date"
            value={exitDate}
            onChange={e => setExitDate(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1">Exit Price</label>
          <input
            type="number"
            step="0.01"
            value={exitPrice}
            onChange={e => setExitPrice(e.target.value)}
            placeholder="0.00"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Quantity */}
      <div>
        <label className="text-xs text-white/40 block mb-1">Quantity</label>
        <input
          type="number"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          min="1"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
        />
      </div>

      {/* Exit Reason */}
      <div>
        <label className="text-xs text-white/40 block mb-1">Exit Reason</label>
        <input
          type="text"
          value={exitReason}
          onChange={e => setExitReason(e.target.value)}
          placeholder="e.g. Hit target, stopped out, expiration"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none transition-colors"
        />
      </div>

      {/* Lessons */}
      <div>
        <label className="text-xs text-white/40 block mb-1">Lessons Learned</label>
        <textarea
          value={lessonsLearned}
          onChange={e => setLessonsLearned(e.target.value)}
          placeholder="What did you learn from this trade?"
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none transition-colors resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !symbol.trim() || !entryPrice}
        className={cn(
          'w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
          isSubmitting || !symbol.trim() || !entryPrice
            ? 'bg-white/5 text-white/30 cursor-not-allowed'
            : 'bg-emerald-500 hover:bg-emerald-600 text-white'
        )}
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        {isSubmitting ? 'Saving...' : 'Add Trade'}
      </button>
    </div>
  )
}

// ============================================
// ANALYTICS DASHBOARD
// ============================================

function AnalyticsDashboard({ analytics }: { analytics: TradeAnalyticsResponse | null }) {
  if (!analytics) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    )
  }

  const { summary, equityCurve, byStrategy } = analytics

  if (summary.totalTrades === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-8 h-8 text-white/10 mx-auto mb-3" />
        <p className="text-sm text-white/40">No closed trades yet</p>
        <p className="text-xs text-white/25 mt-1">Close some trades to see analytics</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Win Rate" value={`${summary.winRate.toFixed(1)}%`} highlight={summary.winRate >= 50} />
        <StatCard
          label="Total P&L"
          value={`${summary.totalPnl >= 0 ? '+' : ''}$${summary.totalPnl.toFixed(2)}`}
          highlight={summary.totalPnl >= 0}
          negative={summary.totalPnl < 0}
        />
        <StatCard label="Profit Factor" value={summary.profitFactor.toFixed(2)} highlight={summary.profitFactor >= 1.5} />
        <StatCard label="Avg Hold" value={`${summary.avgHoldDays.toFixed(1)}d`} />
      </div>

      {/* W/L Breakdown */}
      <div className="glass-card-heavy rounded-lg p-3 border border-white/5">
        <p className="text-xs text-white/40 mb-2">Win / Loss / BE</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden flex">
            {summary.totalTrades > 0 && (
              <>
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${(summary.wins / summary.totalTrades) * 100}%` }}
                />
                <div
                  className="h-full bg-red-500"
                  style={{ width: `${(summary.losses / summary.totalTrades) * 100}%` }}
                />
              </>
            )}
          </div>
          <span className="text-xs text-white/50 whitespace-nowrap">
            {summary.wins}W / {summary.losses}L / {summary.breakeven}BE
          </span>
        </div>
      </div>

      {/* Avg Win / Loss */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card-heavy rounded-lg p-3 border border-white/5">
          <p className="text-xs text-white/30 mb-1">Avg Win</p>
          <p className="text-sm font-medium text-emerald-400">
            +${summary.avgWin.toFixed(2)}
          </p>
        </div>
        <div className="glass-card-heavy rounded-lg p-3 border border-white/5">
          <p className="text-xs text-white/30 mb-1">Avg Loss</p>
          <p className="text-sm font-medium text-red-400">
            ${summary.avgLoss.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Equity Curve (simple text-based representation) */}
      {equityCurve.length > 0 && (
        <div className="glass-card-heavy rounded-lg p-3 border border-white/5">
          <p className="text-xs text-white/40 mb-2">Equity Curve</p>
          <div className="flex items-end gap-0.5 h-16">
            {equityCurve.map((point, i) => {
              const max = Math.max(...equityCurve.map(p => Math.abs(p.pnl)), 1)
              const height = Math.max(Math.abs(point.pnl) / max * 100, 4)
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-1 rounded-t-sm min-w-[2px]',
                    point.pnl >= 0 ? 'bg-emerald-500/60' : 'bg-red-500/60'
                  )}
                  style={{ height: `${height}%` }}
                  title={`${point.date}: $${point.pnl.toFixed(2)}`}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* By Strategy */}
      {Object.keys(byStrategy).length > 0 && (
        <div className="glass-card-heavy rounded-lg p-3 border border-white/5">
          <p className="text-xs text-white/40 mb-2">By Strategy</p>
          <div className="space-y-2">
            {Object.entries(byStrategy).map(([strat, data]) => (
              <div key={strat} className="flex items-center justify-between text-xs">
                <span className="text-white/60">{strat}</span>
                <div className="flex items-center gap-3">
                  <span className="text-white/30">{data.count} trades</span>
                  <span className="text-white/30">{data.winRate.toFixed(0)}% WR</span>
                  <span className={cn(
                    'font-medium',
                    data.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// HELPERS
// ============================================

function OutcomeIcon({ outcome }: { outcome?: TradeOutcome | null }) {
  if (outcome === 'win') return <TrendingUp className="w-4 h-4 text-emerald-400" />
  if (outcome === 'loss') return <TrendingDown className="w-4 h-4 text-red-400" />
  if (outcome === 'breakeven') return <Minus className="w-4 h-4 text-white/30" />
  return <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40" />
}

function StatCard({
  label,
  value,
  highlight,
  negative,
}: {
  label: string
  value: string
  highlight?: boolean
  negative?: boolean
}) {
  return (
    <div className="glass-card-heavy rounded-lg p-3 border border-white/5">
      <p className="text-xs text-white/30 mb-1">{label}</p>
      <p className={cn(
        'text-lg font-semibold',
        negative ? 'text-red-400' : highlight ? 'text-emerald-400' : 'text-white'
      )}>
        {value}
      </p>
    </div>
  )
}
