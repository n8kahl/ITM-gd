'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, TrendingDown, TrendingUp } from 'lucide-react'

/**
 * Pre-Trade Context Widget
 *
 * Shows the trader's recent journal history for a given symbol before entering a
 * new position. Designed to be embedded in the SPX Command Center sidebar or any
 * trading surface.
 *
 * Displays:
 *   - Win rate for the symbol
 *   - Average P&L
 *   - Last N trades with outcomes
 *   - Best setup type and time bucket
 *   - Plan adherence warnings
 *
 * Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md — Phase 4, Slice 4B
 */

interface PreTradeContextProps {
  symbol: string
}

interface ContextTrade {
  id: string
  trade_date: string
  direction: string
  pnl: number | null
  is_winner: boolean | null
  setup_type: string | null
}

interface PreTradeData {
  symbol: string
  recentTrades: ContextTrade[]
  stats: {
    totalTrades: number
    winRate: number | null
    avgPnl: number | null
    avgHoldMinutes: number | null
    followedPlanRate: number | null
  }
  bestSetupType: string | null
  bestTimeBucket: string | null
  commonMistake: string | null
}

export function PreTradeContext({ symbol }: PreTradeContextProps) {
  const [data, setData] = useState<PreTradeData | null>(null)
  const [loading, setLoading] = useState(false)

  const loadContext = useCallback(async () => {
    if (!symbol) return
    setLoading(true)

    try {
      const response = await fetch(`/api/members/journal/context?symbol=${encodeURIComponent(symbol)}&limit=5`, {
        cache: 'no-store',
      })

      if (!response.ok) return

      const payload = await response.json()
      if (payload.success) {
        setData(payload.data as PreTradeData)
      }
    } catch {
      // Non-critical widget — silently fail
    } finally {
      setLoading(false)
    }
  }, [symbol])

  useEffect(() => {
    void loadContext()
  }, [loadContext])

  if (loading) {
    return (
      <div className="rounded-md border border-white/5 bg-white/[0.02] p-3">
        <div className="flex items-center gap-2 text-xs text-white/30">
          <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
          Loading journal context...
        </div>
      </div>
    )
  }

  if (!data || data.stats.totalTrades === 0) return null

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
        <span className="text-[11px] font-medium text-ivory">
          Your <span className="font-mono text-emerald-300">{data.symbol}</span> History
        </span>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-2">
        <div className="rounded bg-white/5 px-2 py-1 text-center">
          <p className="text-[10px] text-white/40">Trades</p>
          <p className="text-xs font-mono text-ivory">{data.stats.totalTrades}</p>
        </div>
        <div className="rounded bg-white/5 px-2 py-1 text-center">
          <p className="text-[10px] text-white/40">Win Rate</p>
          <p className={`text-xs font-mono ${(data.stats.winRate ?? 0) >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.stats.winRate != null ? `${data.stats.winRate}%` : '—'}
          </p>
        </div>
        <div className="rounded bg-white/5 px-2 py-1 text-center">
          <p className="text-[10px] text-white/40">Avg P&L</p>
          <p className={`text-xs font-mono ${(data.stats.avgPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.stats.avgPnl != null ? `$${data.stats.avgPnl.toFixed(2)}` : '—'}
          </p>
        </div>
      </div>

      {/* Recent trades mini-list */}
      <div className="mb-2 space-y-1">
        {data.recentTrades.slice(0, 3).map((trade: ContextTrade) => (
          <div key={trade.id} className="flex items-center justify-between text-[10px]">
            <span className="text-white/40">
              {trade.trade_date.slice(0, 10)} {trade.direction}
            </span>
            <span className="flex items-center gap-1">
              {trade.pnl != null ? (
                <>
                  {trade.pnl >= 0 ? (
                    <TrendingUp className="h-2.5 w-2.5 text-emerald-400" strokeWidth={2} />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5 text-red-400" strokeWidth={2} />
                  )}
                  <span className={`font-mono ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${Math.abs(trade.pnl).toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-white/30">open</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Insights */}
      <div className="space-y-1">
        {data.bestSetupType && (
          <p className="text-[10px] text-emerald-400/80">
            Best setup: <span className="font-medium">{data.bestSetupType}</span>
          </p>
        )}
        {data.bestTimeBucket && (
          <p className="text-[10px] text-emerald-400/80">
            Best time: <span className="font-medium">{data.bestTimeBucket}</span>
          </p>
        )}
        {data.commonMistake && (
          <p className="text-[10px] text-amber-400/80">{data.commonMistake}</p>
        )}
        {data.stats.followedPlanRate != null && data.stats.followedPlanRate < 70 && (
          <p className="text-[10px] text-red-400/80">
            Plan adherence: {data.stats.followedPlanRate}% — consider reviewing your rules
          </p>
        )}
      </div>
    </div>
  )
}
