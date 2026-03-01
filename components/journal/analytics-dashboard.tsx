'use client'

import { Component, type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AdvancedAnalyticsResponse } from '@/lib/types/journal'

class ChartErrorBoundary extends Component<{ title: string, children: ReactNode }, { hasError: boolean }> {
  constructor(props: { title: string, children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          Failed to render {this.props.title} chart.
        </div>
      )
    }

    return this.props.children
  }
}

const PERIODS: Array<'7d' | '30d' | '90d' | '1y' | 'all'> = ['7d', '30d', '90d', '1y', 'all']

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AdvancedAnalyticsResponse | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/members/journal/analytics?period=${period}`)
        const payload = await response.json()

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Failed to load analytics')
        }

        if (active) {
          setData(payload.data)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load analytics')
          setData(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [period])

  const topSymbols = useMemo(() => {
    if (!data || !Array.isArray(data.symbol_stats)) return []
    return data.symbol_stats.slice(0, 8)
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading analytics...
      </div>
    )
  }

  if (error) {
    return <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
  }

  if (!data) {
    return <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">No analytics data.</div>
  }

  const notEnoughData = data.sharpe_ratio == null || data.sortino_ratio == null

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((value) => (
          <Button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            variant={period === value ? 'default' : 'luxury-outline'}
            size="sm"
            className="h-9 px-3 text-xs"
          >
            {value}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Trades" value={String(data.total_trades)} />
        <Stat label="Win Rate" value={data.win_rate == null ? '—' : `${data.win_rate.toFixed(1)}%`} />
        <Stat label="Total P&L" value={`${data.total_pnl >= 0 ? '+' : '-'}$${Math.abs(data.total_pnl).toFixed(2)}`} />
        <Stat label="Profit Factor" value={data.profit_factor == null ? '—' : data.profit_factor.toFixed(2)} />
      </div>

      {notEnoughData ? (
        <p className="rounded-md border border-white/10 bg-white/5 p-3 text-sm text-muted-foreground">
          Not enough data to calculate Sharpe/Sortino (minimum 2 closed trades required).
        </p>
      ) : null}

      <ChartErrorBoundary title="Equity Curve">
        <ChartCard title="Equity Curve">
          {data.equity_curve.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.equity_curve}>
                <CartesianGrid stroke="#2A2F33" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#9AA3AB', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9AA3AB', fontSize: 11 }} />
                <Tooltip />
                <Line dataKey="equity" stroke="#10B981" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyMetric />
          )}
        </ChartCard>
      </ChartErrorBoundary>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartErrorBoundary title="Hourly P&L">
          <ChartCard title="Hourly P&L (ET)">
            {data.hourly_pnl.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.hourly_pnl}>
                  <CartesianGrid stroke="#2A2F33" strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tick={{ fill: '#9AA3AB', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9AA3AB', fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="pnl" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyMetric />
            )}
          </ChartCard>
        </ChartErrorBoundary>

        <ChartErrorBoundary title="Top Symbols">
          <ChartCard title="Top Symbols">
            {topSymbols.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topSymbols}>
                  <CartesianGrid stroke="#2A2F33" strokeDasharray="3 3" />
                  <XAxis dataKey="symbol" tick={{ fill: '#9AA3AB', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9AA3AB', fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="pnl" fill="#60A5FA" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyMetric />
            )}
          </ChartCard>
        </ChartErrorBoundary>
      </div>

      <ChartErrorBoundary title="MFE/MAE Scatter">
        <ChartCard title="MFE vs MAE">
          {data.mfe_mae_scatter.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart>
                <CartesianGrid stroke="#2A2F33" strokeDasharray="3 3" />
                <XAxis dataKey="mfe" tick={{ fill: '#9AA3AB', fontSize: 11 }} />
                <YAxis dataKey="mae" tick={{ fill: '#9AA3AB', fontSize: 11 }} />
                <Tooltip />
                <Scatter data={data.mfe_mae_scatter} fill="#F59E0B" />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <EmptyMetric />
          )}
        </ChartCard>
      </ChartErrorBoundary>
    </section>
  )
}

function Stat({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ivory">{value}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string, children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <h3 className="mb-2 text-sm font-medium text-ivory">{title}</h3>
      {children}
    </div>
  )
}

function EmptyMetric() {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-muted-foreground">
      Not enough data
    </div>
  )
}
