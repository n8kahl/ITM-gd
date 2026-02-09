'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

// ============================================
// TYPES
// ============================================

interface EquityPoint {
  date: string
  cumulative_pnl: number
}

type TimeRange = '7d' | '30d' | '90d' | 'ytd' | 'all'

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string; days: number }[] = [
  { value: '7d', label: '7D', days: 7 },
  { value: '30d', label: '30D', days: 30 },
  { value: '90d', label: '90D', days: 90 },
  { value: 'ytd', label: 'YTD', days: 365 },
  { value: 'all', label: 'All', days: 9999 },
]

// ============================================
// CUSTOM TOOLTIP
// ============================================

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null

  const value = payload[0].value as number
  const isPositive = value >= 0

  return (
    <div className="glass-card-heavy px-3 py-2 rounded-lg text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className={cn(
        'font-mono font-semibold tabular-nums',
        isPositive ? 'text-emerald-400' : 'text-red-400'
      )}>
        {isPositive ? '+' : ''}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </p>
    </div>
  )
}

// ============================================
// COMPONENT
// ============================================

export function EquityCurve() {
  const [data, setData] = useState<EquityPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const { session, isLoading: isAuthLoading } = useMemberAuth()

  useEffect(() => {
    const accessToken = session?.access_token
    if (isAuthLoading) return
    if (!accessToken) {
      setLoading(false)
      return
    }

    async function fetchData() {
      setLoading(true)
      try {
        const days = TIME_RANGE_OPTIONS.find(t => t.value === timeRange)?.days ?? 30
        const res = await fetch(`/api/members/dashboard/equity-curve?days=${days}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        const result = await res.json()
        if (result.success && Array.isArray(result.data)) {
          setData(result.data)
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [timeRange, isAuthLoading, session?.access_token])

  const hasData = data.length > 0
  const currentPnl = hasData ? data[data.length - 1].cumulative_pnl : 0
  const isPositive = currentPnl >= 0

  return (
    <div className="glass-card-heavy rounded-2xl p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-ivory">P&L Equity Curve</h3>
          {hasData && (
            <p className={cn(
              'font-mono text-lg font-semibold tabular-nums mt-0.5',
              isPositive ? 'text-emerald-400' : 'text-red-400'
            )}>
              {isPositive ? '+' : ''}${currentPnl.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </p>
          )}
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
          {TIME_RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                timeRange === opt.value
                  ? 'bg-emerald-900/30 text-emerald-400'
                  : 'text-muted-foreground hover:text-ivory'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[240px] lg:h-[280px]">
        {loading ? (
          <div className="w-full h-full rounded-xl bg-white/[0.02] animate-pulse" />
        ) : !hasData ? (
          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
            No trade data yet. Start logging trades to see your equity curve.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9A9A9A', fontSize: 10, fontFamily: 'var(--font-geist-mono)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9A9A9A', fontSize: 10, fontFamily: 'var(--font-geist-mono)' }}
                tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="cumulative_pnl"
                stroke="#F3E5AB"
                strokeWidth={2}
                fill="url(#equityGradient)"
                animationDuration={800}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
