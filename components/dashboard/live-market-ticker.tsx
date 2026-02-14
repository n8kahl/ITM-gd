'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Counter } from '@/components/ui/counter'
import { useMarketIndices, useMarketStatus } from '@/hooks/useMarketData'

// ============================================
// HELPERS
// ============================================

function getMarketStatusLabel(status: string, session: string): string {
  if (status === 'closed') return 'Market Closed'
  if (status === 'early-close') return 'Early Close'

  switch (session) {
    case 'pre-market': return 'Pre-Market'
    case 'regular': return 'Market Open'
    case 'after-hours': return 'After Hours'
    default: return 'Market Open'
  }
}

function getMarketStatusColor(status: string, session: string): string {
  if (status === 'closed') return 'bg-gray-500'
  if (status === 'early-close') return 'bg-amber-400'

  switch (session) {
    case 'regular': return 'bg-emerald-400'
    case 'pre-market': return 'bg-amber-400'
    case 'after-hours': return 'bg-blue-400'
    default: return 'bg-gray-500'
  }
}

function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return '—'
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getIVRankColor(ivRank: number): string {
  if (ivRank < 25) return 'text-emerald-400'
  if (ivRank < 50) return 'text-ivory'
  if (ivRank < 75) return 'text-champagne'
  return 'text-amber-400'
}

// ============================================
// COMPONENT
// ============================================

export function LiveMarketTicker() {
  const { indices, metrics, source, isLoading, isError: isIndicesError } = useMarketIndices();
  const { status: marketStatusData, isError: isStatusError } = useMarketStatus();
  const marketFeedUnavailable = Boolean(isIndicesError || isStatusError)

  // Derived state
  const isLive = source === 'massive';
  const currentStatus = marketStatusData?.status || 'closed';
  const currentSession = marketStatusData?.session || 'closed';

  const statusDotColor = marketFeedUnavailable
    ? 'bg-red-400'
    : isLive
    ? 'bg-emerald-400'
    : 'bg-amber-400';

  return (
    <div className="w-full rounded-xl glass-card py-3 px-4 lg:px-6">
      <div className="flex items-center gap-4 lg:gap-6 overflow-x-auto scrollbar-none">
        {/* Connection indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={cn('w-1.5 h-1.5 rounded-full', statusDotColor, currentStatus === 'open' && isLive && 'animate-pulse')} />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {marketFeedUnavailable ? 'Data Unavailable' : getMarketStatusLabel(currentStatus, currentSession)}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/[0.08] flex-shrink-0" />

        {/* Quotes */}
        {indices.length === 0 && isLoading ? (
          <div className="flex items-center gap-4">
            <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
          </div>
        ) : marketFeedUnavailable && indices.length === 0 ? (
          <div className="text-xs text-muted-foreground">Live market feed unavailable</div>
        ) : (
          indices.map(quote => {
            const isUp = quote.change >= 0

            return (
              <div key={quote.symbol} className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground font-medium">{quote.symbol}</span>
                <Counter
                  value={quote.price}
                  className="text-sm font-semibold text-ivory"
                  format={(value) => `$${formatPrice(value)}`}
                  flashDirection={isUp ? 'up' : 'down'}
                />
                <Counter
                  value={quote.changePercent}
                  className={cn(
                    'font-mono text-xs tabular-nums',
                    isUp ? 'text-emerald-400' : 'text-red-400'
                  )}
                  format={(value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`}
                  flashDirection={isUp ? 'up' : 'down'}
                />
              </div>
            )
          })
        )}


        {/* Divider */}
        <div className="w-px h-6 bg-white/[0.08] flex-shrink-0 hidden md:block" />

        {/* Metrics */}
        {metrics?.vwap != null && (
          <div className="flex items-center gap-1.5 flex-shrink-0 hidden md:flex">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">VWAP</span>
            <Counter
              value={metrics.vwap}
              className="text-xs text-ivory"
              format={(value) => `$${formatPrice(value)}`}
            />
          </div>
        )}

        {metrics?.atr != null && (
          <div className="flex items-center gap-1.5 flex-shrink-0 hidden md:flex">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">ATR</span>
            <Counter
              value={metrics.atr}
              className="text-xs text-ivory"
              format={(value) => `$${value.toFixed(2)}`}
            />
          </div>
        )}

        {metrics?.ivRank != null && (
          <div className="flex items-center gap-1.5 flex-shrink-0 hidden lg:flex">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">IV Rank</span>
            <Counter
              value={metrics.ivRank}
              className={cn('text-xs', getIVRankColor(metrics.ivRank))}
              format={(value) => `${value.toFixed(0)}%`}
            />
          </div>
        )}

        {/* Market Status Pill (right side on desktop) */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0 hidden lg:flex">
          <div className={cn(
            'w-2 h-2 rounded-full',
            getMarketStatusColor(currentStatus, currentSession),
            currentStatus === 'open' && 'animate-pulse'
          )} />
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {new Date().toLocaleTimeString('en-US', {
              timeZone: 'America/New_York',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })} ET
          </span>
        </div>
      </div>
    </div>
  )
}
