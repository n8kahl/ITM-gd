'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { Counter } from '@/components/ui/counter'

// ============================================
// TYPES
// ============================================

interface EquityPoint {
  date: string
  cumulative_pnl: number | null
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

  const rawValue = payload[0].value
  const value = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : 0
  const isPositive = value >= 0

  return (
    <div className="glass-card-heavy rounded-xl border border-white/10 px-3 py-2 text-xs shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
      <p className="text-muted-foreground mb-1 uppercase tracking-[0.12em] text-[10px]">{label}</p>
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
          const normalizedData = result.data.map((point: Partial<EquityPoint> & { date?: unknown; cumulative_pnl?: unknown }) => {
            const cumulative = Number(point.cumulative_pnl)
            return {
              date: typeof point.date === 'string' ? point.date : '',
              cumulative_pnl: Number.isFinite(cumulative) ? cumulative : 0,
            }
          })
          setData(normalizedData)
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
  const lastPointValue = hasData ? Number(data[data.length - 1].cumulative_pnl) : 0
  const currentPnl = Number.isFinite(lastPointValue) ? lastPointValue : 0
  const isPositive = currentPnl >= 0

  return (
    <div className="glass-card-heavy rounded-2xl p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-ivory">P&L Equity Curve</h3>
          {hasData && (
            <Counter
              value={currentPnl}
              className={cn(
                'text-lg font-semibold mt-0.5',
                isPositive ? 'text-emerald-400' : 'text-red-400',
              )}
              format={(value) => `${value >= 0 ? '+' : ''}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
              flashDirection={isPositive ? 'up' : 'down'}
            />
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
          <div className="w-full h-full rounded-xl shimmer-surface" />
        ) : !hasData ? (
          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
            No trade data yet. Start logging trades to see your equity curve.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
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
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="cumulative_pnl"
                stroke="#10B981"
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
