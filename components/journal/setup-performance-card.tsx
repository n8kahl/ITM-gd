'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react'

/**
 * Setup Performance & Regime Breakdown Card
 *
 * Displays performance broken down by:
 *   1. Setup type (from SPX CC detector)
 *   2. Regime tags (VIX bucket, trend state, GEX regime, time bucket)
 *
 * Fetches data from the enhanced analytics endpoint.
 *
 * Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md — Phase 3, Slice 3E
 */

interface SetupStat {
  setup_type: string
  pnl: number
  count: number
  win_rate: number
}

interface RegimeStat {
  value: string
  pnl: number
  count: number
  win_rate: number
}

interface PerformanceData {
  setup_stats: SetupStat[]
  regime_stats: Record<string, RegimeStat[]>
}

type ViewTab = 'setup' | 'regime'

const REGIME_LABELS: Record<string, string> = {
  vix_bucket: 'VIX Bucket',
  trend_state: 'Trend State',
  gex_regime: 'GEX Regime',
  time_bucket: 'Time of Day',
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : ''
  return `${sign}$${pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function StatRow({ label, pnl, count, winRate }: { label: string; pnl: number; count: number; winRate: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-2">
      <div>
        <span className="text-xs font-medium text-ivory">{label}</span>
        <span className="ml-2 text-[11px] text-white/40">{count} trades</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-mono ${winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
          {winRate.toFixed(1)}%
        </span>
        <span className={`text-xs font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatPnl(pnl)}
        </span>
        {pnl >= 0 ? (
          <TrendingUp className="h-3 w-3 text-emerald-400" strokeWidth={1.5} />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-400" strokeWidth={1.5} />
        )}
      </div>
    </div>
  )
}

export function SetupPerformanceCard() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewTab>('setup')
  const [selectedRegimeKey, setSelectedRegimeKey] = useState('time_bucket')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/members/journal/analytics?period=90d', { cache: 'no-store' })
      if (!response.ok) throw new Error(`Request failed (${response.status})`)

      const payload = await response.json()
      if (!payload.success) throw new Error(payload.error ?? 'Failed to load analytics')

      setData({
        setup_stats: payload.data?.setup_stats ?? [],
        regime_stats: payload.data?.regime_stats ?? {},
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const regimeKeys = data ? Object.keys(data.regime_stats).filter((k) => (data.regime_stats[k]?.length ?? 0) > 0) : []

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
          <h3 className="text-sm font-medium text-ivory">Performance Breakdown</h3>
        </div>
        <div className="flex gap-1">
          {(['setup', 'regime'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setView(tab)}
              className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                view === tab
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab === 'setup' ? 'Setup Type' : 'Regime'}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="py-4 text-center text-xs text-white/50">Loading performance data...</div>
      ) : error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : view === 'setup' ? (
        <div className="space-y-1.5">
          {data && data.setup_stats.length > 0 ? (
            data.setup_stats.map((stat: SetupStat) => (
              <StatRow
                key={stat.setup_type}
                label={stat.setup_type}
                pnl={stat.pnl}
                count={stat.count}
                winRate={stat.win_rate}
              />
            ))
          ) : (
            <p className="text-xs text-white/50">
              No setup type data yet. Trades from SPX Command Center will be tagged automatically.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {regimeKeys.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1">
                {regimeKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedRegimeKey(key)}
                    className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                      selectedRegimeKey === key
                        ? 'bg-white/10 text-ivory'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    {REGIME_LABELS[key] ?? key}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                {(data?.regime_stats[selectedRegimeKey] ?? []).map((stat: RegimeStat) => (
                  <StatRow
                    key={stat.value}
                    label={stat.value.replace(/_/g, ' ')}
                    pnl={stat.pnl}
                    count={stat.count}
                    winRate={stat.win_rate}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-white/50">
              No regime data yet. Market context is captured automatically for new trades.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
