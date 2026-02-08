'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

// ============================================
// TYPES
// ============================================

interface MarketQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  updatedAt: number
}

interface MarketMetrics {
  vwap?: number
  atr?: number
  ivRank?: number
}

type ConnectionStatus = 'live' | 'polling' | 'disconnected'
type MarketStatus = 'pre-market' | 'open' | 'after-hours' | 'closed'

// ============================================
// HELPERS
// ============================================

function getMarketStatus(): MarketStatus {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const hours = et.getHours()
  const minutes = et.getMinutes()
  const day = et.getDay()
  const time = hours * 60 + minutes

  if (day === 0 || day === 6) return 'closed'
  if (time >= 240 && time < 570) return 'pre-market'  // 4:00 - 9:30
  if (time >= 570 && time < 960) return 'open'         // 9:30 - 16:00
  if (time >= 960 && time < 1200) return 'after-hours'  // 16:00 - 20:00
  return 'closed'
}

function getMarketStatusLabel(status: MarketStatus): string {
  switch (status) {
    case 'pre-market': return 'Pre-Market'
    case 'open': return 'Market Open'
    case 'after-hours': return 'After Hours'
    case 'closed': return 'Market Closed'
  }
}

function getMarketStatusColor(status: MarketStatus): string {
  switch (status) {
    case 'open': return 'bg-emerald-400'
    case 'pre-market': return 'bg-amber-400'
    case 'after-hours': return 'bg-blue-400'
    case 'closed': return 'bg-gray-500'
  }
}

function formatPrice(price: number): string {
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
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({})
  const [metrics, setMetrics] = useState<MarketMetrics>({})
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(getMarketStatus())
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Update market status every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(getMarketStatus())
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Fetch market data via REST polling
  const fetchMarketData = useCallback(async () => {
    try {
      const res = await fetch('/api/members/dashboard/market-ticker')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()

      if (data.success && data.data) {
        const newQuotes: Record<string, MarketQuote> = {}
        for (const q of data.data.quotes || []) {
          newQuotes[q.symbol] = {
            symbol: q.symbol,
            price: q.price,
            change: q.change,
            changePercent: q.changePercent,
            updatedAt: Date.now(),
          }
        }
        if (Object.keys(newQuotes).length > 0) {
          setQuotes(newQuotes)
          setConnectionStatus('polling')
        }
        if (data.data.metrics) {
          setMetrics(data.data.metrics)
        }
      }
    } catch {
      setConnectionStatus('disconnected')
    }
  }, [])

  // Poll on mount, then every 15 seconds
  useEffect(() => {
    fetchMarketData()
    pollIntervalRef.current = setInterval(fetchMarketData, 15_000)
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [fetchMarketData])

  const statusDotColor = connectionStatus === 'live'
    ? 'bg-emerald-400'
    : connectionStatus === 'polling'
    ? 'bg-amber-400'
    : 'bg-red-400'

  return (
    <div className="w-full rounded-xl glass-card py-3 px-4 lg:px-6">
      <div className="flex items-center gap-4 lg:gap-6 overflow-x-auto scrollbar-none">
        {/* Connection indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={cn('w-1.5 h-1.5 rounded-full', statusDotColor, marketStatus === 'open' && connectionStatus !== 'disconnected' && 'animate-pulse')} />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {getMarketStatusLabel(marketStatus)}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/[0.08] flex-shrink-0" />

        {/* Quotes */}
        {['SPX', 'NDX'].map(symbol => {
          const quote = quotes[symbol]
          const isUp = (quote?.change ?? 0) >= 0

          return (
            <div key={symbol} className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-muted-foreground font-medium">{symbol}</span>
              <span className="font-mono text-sm font-semibold text-ivory tabular-nums">
                {quote ? `$${formatPrice(quote.price)}` : '—'}
              </span>
              {quote && (
                <span className={cn(
                  'font-mono text-xs tabular-nums',
                  isUp ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {isUp ? '+' : ''}{quote.changePercent.toFixed(2)}%
                </span>
              )}
            </div>
          )
        })}

        {/* Divider */}
        <div className="w-px h-6 bg-white/[0.08] flex-shrink-0 hidden md:block" />

        {/* Metrics */}
        {metrics.vwap != null && (
          <div className="flex items-center gap-1.5 flex-shrink-0 hidden md:flex">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">VWAP</span>
            <span className="font-mono text-xs text-ivory tabular-nums">
              ${formatPrice(metrics.vwap)}
            </span>
          </div>
        )}

        {metrics.atr != null && (
          <div className="flex items-center gap-1.5 flex-shrink-0 hidden md:flex">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">ATR</span>
            <span className="font-mono text-xs text-ivory tabular-nums">
              ${metrics.atr.toFixed(2)}
            </span>
          </div>
        )}

        {metrics.ivRank != null && (
          <div className="flex items-center gap-1.5 flex-shrink-0 hidden lg:flex">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">IV Rank</span>
            <span className={cn('font-mono text-xs tabular-nums', getIVRankColor(metrics.ivRank))}>
              {metrics.ivRank}%
            </span>
          </div>
        )}

        {/* Market Status Pill (right side on desktop) */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0 hidden lg:flex">
          <div className={cn(
            'w-2 h-2 rounded-full',
            getMarketStatusColor(marketStatus),
            marketStatus === 'open' && 'animate-pulse'
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
