'use client'

import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

interface EquitySparklineProps {
  data: Array<{ date: string; cumulative_pnl: number }>
  className?: string
}

export function EquitySparkline({ data, className }: EquitySparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center h-16 text-xs text-[#9A9A9A]',
          className
        )}
      >
        No equity data available
      </div>
    )
  }

  return (
    <div className={cn('w-full h-16', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
        >
          <defs>
            <linearGradient id="equitySparkGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="cumulative_pnl"
            stroke="#10B981"
            strokeWidth={1.5}
            fill="url(#equitySparkGradient)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
