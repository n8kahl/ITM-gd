'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { TradeCardDisplayData } from '@/lib/types/social'
import { TrendingUp, TrendingDown, Award } from 'lucide-react'

interface FeedTradeCardProps {
  displayData: TradeCardDisplayData
  className?: string
}

export function FeedTradeCard({ displayData, className }: FeedTradeCardProps) {
  const {
    symbol,
    direction,
    pnl,
    pnl_percentage,
    is_winner,
    ai_grade,
    strategy,
    contract_type,
    entry_price,
    exit_price,
    image_url,
  } = displayData

  const isPositive = is_winner === true || (pnl !== null && pnl > 0)

  const formatPnl = (value: number | null): string => {
    if (value === null) return '--'
    const sign = value >= 0 ? '+' : ''
    return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatPercentage = (value: number | null): string => {
    if (value === null) return ''
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}%`
  }

  const formatPrice = (value: number | null): string => {
    if (value === null) return '--'
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Symbol and Direction */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-white">{symbol}</span>
          <Badge
            variant="outline"
            className={cn(
              'text-xs uppercase tracking-wider',
              direction === 'long'
                ? 'border-emerald-500/30 text-emerald-400'
                : 'border-red-500/30 text-red-400'
            )}
          >
            {direction === 'long' ? (
              <TrendingUp className="mr-1 h-3 w-3" />
            ) : (
              <TrendingDown className="mr-1 h-3 w-3" />
            )}
            {direction.toUpperCase()}
          </Badge>
          <Badge variant="secondary" className="text-xs text-white/60">
            {contract_type.toUpperCase()}
          </Badge>
        </div>

        {ai_grade && (
          <Badge
            className={cn(
              'text-xs font-bold',
              ai_grade === 'A' || ai_grade === 'A+'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : ai_grade === 'B' || ai_grade === 'B+'
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                  : ai_grade === 'C'
                    ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-400'
            )}
          >
            <Award className="mr-1 h-3 w-3" />
            Grade: {ai_grade}
          </Badge>
        )}
      </div>

      {/* P&L Display */}
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            'font-mono text-2xl font-bold tracking-tight',
            isPositive ? 'text-emerald-400' : 'text-red-400'
          )}
        >
          {formatPnl(pnl)}
        </span>
        {pnl_percentage !== null && (
          <span
            className={cn(
              'font-mono text-sm',
              isPositive ? 'text-emerald-400/70' : 'text-red-400/70'
            )}
          >
            {formatPercentage(pnl_percentage)}
          </span>
        )}
      </div>

      {image_url && (
        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30 p-2 sm:p-3">
          <div className="flex items-center justify-center rounded-md border border-white/5 bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image_url}
              alt={`${symbol} shared trade card`}
              className="h-auto max-h-[320px] w-auto max-w-full object-contain sm:max-h-[420px]"
              loading="lazy"
            />
          </div>
        </div>
      )}

      {/* Entry / Exit Prices */}
      {(entry_price !== null || exit_price !== null) && (
        <div className="flex items-center gap-4 text-xs text-white/50">
          {entry_price !== null && (
            <span>
              Entry: <span className="font-mono text-white/70">{formatPrice(entry_price)}</span>
            </span>
          )}
          {exit_price !== null && (
            <span>
              Exit: <span className="font-mono text-white/70">{formatPrice(exit_price)}</span>
            </span>
          )}
        </div>
      )}

      {/* Strategy */}
      {strategy && (
        <div className="text-xs text-white/40">
          Strategy: <span className="text-white/60">{strategy}</span>
        </div>
      )}
    </div>
  )
}
