'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { CandlestickChart, Maximize2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ChartRequest } from './center-panel'
import type { LevelAnnotation } from './trading-chart'
import type { ChartBar } from '@/lib/api/ai-coach'
import { usePriceStream } from '@/hooks/use-price-stream'
import { mergeRealtimePriceIntoBars } from './chart-realtime'

const TradingChart = dynamic(
  () => import('./trading-chart').then((mod) => mod.TradingChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center text-xs text-white/35">
        Loading chart...
      </div>
    ),
  },
)

interface InlineMiniChartProps {
  chartRequest: ChartRequest
  accessToken?: string
  onExpand?: () => void
  className?: string
}

function buildLevelAnnotations(request: ChartRequest): LevelAnnotation[] {
  const annotations: LevelAnnotation[] = []
  const levelColors: Record<string, string> = {
    PDH: '#ef4444',
    PMH: '#f97316',
    R1: '#ef4444',
    R2: '#dc2626',
    PDL: '#10B981',
    PML: '#22d3ee',
    S1: '#10B981',
    S2: '#059669',
    PP: '#f3e5ab',
    VWAP: '#eab308',
  }

  for (const level of request.levels?.resistance ?? []) {
    const key = (level.name || level.type || 'R').toUpperCase().replace(/\s+/g, '')
    annotations.push({
      price: level.price,
      label: level.displayLabel || level.name || level.type || 'Resistance',
      color: levelColors[key] || '#ef4444',
      lineWidth: level.strength === 'strong' || level.strength === 'critical' ? 2 : 1,
      lineStyle: level.strength === 'dynamic' ? 'dashed' : 'solid',
      side: 'resistance',
    })
  }

  for (const level of request.levels?.support ?? []) {
    const key = (level.name || level.type || 'S').toUpperCase().replace(/\s+/g, '')
    annotations.push({
      price: level.price,
      label: level.displayLabel || level.name || level.type || 'Support',
      color: levelColors[key] || '#10B981',
      lineWidth: level.strength === 'strong' || level.strength === 'critical' ? 2 : 1,
      lineStyle: level.strength === 'dynamic' ? 'dashed' : 'solid',
      side: 'support',
    })
  }

  for (const fib of request.levels?.fibonacci ?? []) {
    annotations.push({
      price: fib.price,
      label: fib.name,
      color: '#a78bfa',
      lineWidth: fib.isMajor ? 2 : 1,
      lineStyle: 'dashed',
    })
  }

  if (request.levels?.indicators?.vwap) {
    annotations.push({
      price: request.levels.indicators.vwap,
      label: 'VWAP',
      color: '#eab308',
      lineWidth: 2,
      lineStyle: 'solid',
    })
  }

  return annotations
}

export function InlineMiniChart({ chartRequest, accessToken, onExpand, className }: InlineMiniChartProps) {
  const [bars, setBars] = useState<ChartBar[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const realtimeTickKeyRef = useRef<string | null>(null)
  const stream = usePriceStream([chartRequest.symbol], Boolean(accessToken), accessToken || null)
  const livePriceUpdate = useMemo(
    () => stream.prices.get(chartRequest.symbol.toUpperCase()) || null,
    [chartRequest.symbol, stream.prices],
  )

  const loadChart = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { getChartData } = await import('@/lib/api/ai-coach')
      const data = await getChartData(chartRequest.symbol, chartRequest.timeframe, accessToken)
      setBars(data.bars)
    } catch {
      setError('Chart unavailable')
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, chartRequest.symbol, chartRequest.timeframe])

  useEffect(() => {
    void loadChart()
  }, [loadChart])

  useEffect(() => {
    realtimeTickKeyRef.current = null
  }, [chartRequest.symbol, chartRequest.timeframe])

  useEffect(() => {
    if (!livePriceUpdate) return
    const tickKey = `${chartRequest.symbol}|${livePriceUpdate.timestamp}|${livePriceUpdate.price}`
    if (realtimeTickKeyRef.current === tickKey) return
    realtimeTickKeyRef.current = tickKey

    setBars((prev) => (
      mergeRealtimePriceIntoBars(
        prev,
        chartRequest.timeframe,
        livePriceUpdate.price,
        livePriceUpdate.timestamp,
      ).bars
    ))
  }, [chartRequest.symbol, chartRequest.timeframe, livePriceUpdate])

  const levels = buildLevelAnnotations(chartRequest)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-white/10 bg-black/30 overflow-hidden mt-2',
        'cursor-pointer hover:border-emerald-500/30 transition-colors group',
        className,
      )}
      onClick={onExpand}
      role="button"
      aria-label={`Expand ${chartRequest.symbol} chart to full screen`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onExpand?.()
        }
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <CandlestickChart className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-white">{chartRequest.symbol}</span>
          <span className="text-[10px] text-white/40">{chartRequest.timeframe}</span>
          {accessToken && (
            <span
              className={cn(
                'text-[9px] px-1 py-0.5 rounded border',
                stream.isConnected
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/15 text-amber-200',
              )}
            >
              {stream.isConnected ? 'LIVE' : 'RETRY'}
            </span>
          )}
        </div>
        <Maximize2 className="w-3 h-3 text-white/30 group-hover:text-emerald-400 transition-colors" />
      </div>

      <div className="h-[200px] relative">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-white/35">Loading chart...</div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-xs text-white/35">{error}</div>
        ) : (
          <TradingChart
            symbol={chartRequest.symbol}
            timeframe={chartRequest.timeframe}
            bars={bars}
            levels={levels}
            indicators={{
              ema8: false,
              ema21: false,
              vwap: true,
              openingRange: false,
              rsi: false,
              macd: false,
            }}
          />
        )}
      </div>
    </motion.div>
  )
}
