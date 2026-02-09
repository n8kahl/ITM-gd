'use client'

import { cn } from '@/lib/utils'
import type { ChartTimeframe } from '@/lib/api/ai-coach'

// ============================================
// TYPES
// ============================================

interface ChartToolbarProps {
  symbol: string
  timeframe: ChartTimeframe
  onSymbolChange: (symbol: string) => void
  onTimeframeChange: (timeframe: ChartTimeframe) => void
  isLoading?: boolean
}

// ============================================
// CONSTANTS
// ============================================

const SYMBOLS = ['SPX', 'NDX'] as const

const TIMEFRAMES: { value: ChartTimeframe; label: string }[] = [
  { value: '1m',  label: '1m' },
  { value: '5m',  label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h',  label: '1H' },
  { value: '4h',  label: '4H' },
  { value: '1D',  label: '1D' },
]

// ============================================
// COMPONENT
// ============================================

export function ChartToolbar({
  symbol,
  timeframe,
  onSymbolChange,
  onTimeframeChange,
  isLoading,
}: ChartToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5">
      {/* Symbol Selector */}
      <div className="flex gap-1">
        {SYMBOLS.map((sym) => (
          <button
            key={sym}
            onClick={() => onSymbolChange(sym)}
            disabled={isLoading}
            className={cn(
              'px-2.5 py-1 text-xs font-mono font-medium rounded transition-all',
              symbol === sym
                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                : 'text-white/40 hover:text-white/60 border border-transparent'
            )}
          >
            {sym}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-white/10" />

      {/* Timeframe Selector */}
      <div className="flex gap-0.5">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => onTimeframeChange(tf.value)}
            disabled={isLoading}
            className={cn(
              'px-2 py-1 text-xs rounded transition-all',
              timeframe === tf.value
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'text-white/30 hover:text-white/50'
            )}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="ml-auto">
          <div className="w-3 h-3 border border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
