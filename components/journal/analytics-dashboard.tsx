'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
} from 'recharts'
import { Loader2, RefreshCw } from 'lucide-react'
import type { AdvancedAnalyticsResponse } from '@/lib/types/journal'
import { createAppError, createAppErrorFromResponse, notifyAppError } from '@/lib/error-handler'

type AnalyticsTab = 'execution' | 'risk' | 'timing' | 'strategy'
type AnalyticsPeriod = '7d' | '30d' | '90d' | '1y'

const TAB_OPTIONS: Array<{ id: AnalyticsTab; label: string }> = [
  { id: 'execution', label: 'Execution' },
  { id: 'risk', label: 'Risk' },
  { id: 'timing', label: 'Timing' },
  { id: 'strategy', label: 'Strategy' },
]

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatCurrency(value: number): string {
  const prefix = value >= 0 ? '+' : '-'
  return `${prefix}$${Math.abs(value).toFixed(2)}`
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(2)
}

function dayLabel(day: number): string {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return labels[day] || String(day)
}

interface StatCardProps {
  title: string
  value: string
  tone?: 'neutral' | 'positive' | 'negative'
}

function StatCard({ title, value, tone = 'neutral' }: StatCardProps) {
  const toneClass = tone === 'positive'
    ? 'text-emerald-400'
    : tone === 'negative'
      ? 'text-red-400'
      : 'text-ivory'

  return (
    <div className="glass-card rounded-xl p-4 border border-white/[0.06]">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{title}</p>
      <p className={`text-xl font-mono font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  )
}

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('execution')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AdvancedAnalyticsResponse | null>(null)

  const loadAnalytics = useCallback(async (selectedPeriod: AnalyticsPeriod) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/members/journal/analytics?period=${selectedPeriod}`)
      if (!response.ok) {
        throw await createAppErrorFromResponse(response)
      }
      const result = await response.json()
      if (!result.success || !result.data) {
        throw createAppError('Analytics payload was empty.')
      }
      setData(result.data)
    } catch (error) {
      notifyAppError(createAppError(error), {
        onRetry: () => {
          void loadAnalytics(selectedPeriod)
        },
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAnalytics(period)
  }, [loadAnalytics, period])

  const equityData = useMemo(() => data?.equity_curve || [], [data])
  const mfeMaeData = useMemo(() => data?.mfe_mae_scatter || [], [data])

  if (loading && !data) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="glass-card rounded-xl p-6 text-center text-muted-foreground">
        Unable to load analytics right now.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-serif text-ivory">Journal Analytics</h2>
          <button
            type="button"
            onClick={() => {
              void loadAnalytics(period)
            }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-ivory hover:bg-white/[0.04]"
            aria-label="Refresh analytics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d', '1y'] as AnalyticsPeriod[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              className={`px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                period === option
                  ? 'bg-emerald-900/30 text-emerald-300'
                  : 'text-muted-foreground hover:text-ivory hover:bg-white/[0.04]'
              }`}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard title="Win Rate" value={formatPercent(data.win_rate)} tone={data.win_rate >= 50 ? 'positive' : 'negative'} />
        <StatCard title="Expectancy" value={formatCurrency(data.expectancy)} tone={data.expectancy >= 0 ? 'positive' : 'negative'} />
        <StatCard title="Profit Factor" value={data.profit_factor == null ? '—' : formatNumber(data.profit_factor)} tone={(data.profit_factor || 0) >= 1 ? 'positive' : 'negative'} />
        <StatCard title="Sharpe Ratio" value={formatNumber(data.sharpe_ratio)} tone={data.sharpe_ratio >= 0 ? 'positive' : 'negative'} />
        <StatCard title="Max Drawdown" value={formatCurrency(data.max_drawdown)} tone={data.max_drawdown >= 0 ? 'positive' : 'negative'} />
        <StatCard title="Avg R-Multiple" value={formatNumber(data.avg_r_multiple)} tone={data.avg_r_multiple >= 0 ? 'positive' : 'negative'} />
      </div>

      <div className="flex flex-wrap items-center gap-1 bg-white/[0.03] rounded-lg p-1">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
              activeTab === tab.id ? 'bg-white/[0.08] text-ivory' : 'text-muted-foreground hover:text-ivory'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'execution' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="glass-card rounded-xl p-4 h-[300px]">
            <p className="text-xs text-muted-foreground mb-3">MFE vs MAE Scatter</p>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="mae" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis dataKey="mfe" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number) => `${Number(value).toFixed(2)}%`} />
                <Scatter data={mfeMaeData} fill="#10B981" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card rounded-xl p-4 h-[300px]">
            <p className="text-xs text-muted-foreground mb-3">Equity Curve</p>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="trade_date" hide />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="equity" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'risk' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="glass-card rounded-xl p-4 h-[300px]">
            <p className="text-xs text-muted-foreground mb-3">R-Multiple Distribution</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.r_multiple_distribution || []}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="bucket" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card rounded-xl p-4 h-[300px]">
            <p className="text-xs text-muted-foreground mb-3">DTE Bucket Performance</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dte_buckets}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="bucket" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number, key: string) => key === 'win_rate' ? `${Number(value).toFixed(1)}%` : Number(value).toFixed(2)} />
                <Bar dataKey="win_rate" fill="#F3E5AB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'timing' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="glass-card rounded-xl p-4 h-[300px]">
            <p className="text-xs text-muted-foreground mb-3">Time of Day P&L</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hourly_pnl}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="hour_of_day" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                <Bar dataKey="pnl" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card rounded-xl p-4 h-[300px]">
            <p className="text-xs text-muted-foreground mb-3">Day of Week P&L</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.day_of_week_pnl.map((item) => ({ ...item, label: dayLabel(item.day_of_week) }))}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                <Bar dataKey="pnl" fill="#F3E5AB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'strategy' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="glass-card rounded-xl p-4 h-[300px]">
            <p className="text-xs text-muted-foreground mb-3">Symbol Performance</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.symbol_stats.slice(0, 10)}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="symbol" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number, key: string) => key === 'win_rate' ? `${Number(value).toFixed(1)}%` : formatCurrency(Number(value))} />
                <Bar dataKey="pnl" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card rounded-xl p-4 h-[300px]">
            <p className="text-xs text-muted-foreground mb-3">Direction Win Rate</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.direction_stats}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="direction" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                <Bar dataKey="win_rate" fill="#F3E5AB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
