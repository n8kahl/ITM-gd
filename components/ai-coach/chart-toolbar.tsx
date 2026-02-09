'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ChartTimeframe } from '@/lib/api/ai-coach'
import { SymbolSearch } from './symbol-search'
import type { IndicatorConfig } from './chart-indicators'

// ============================================
// TYPES
// ============================================

interface ChartToolbarProps {
  symbol: string
  timeframe: ChartTimeframe
  onSymbolChange: (symbol: string) => void
  onTimeframeChange: (timeframe: ChartTimeframe) => void
  indicators: IndicatorConfig
  onIndicatorsChange: (next: IndicatorConfig) => void
  isLoading?: boolean
}

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
  indicators,
  onIndicatorsChange,
  isLoading,
}: ChartToolbarProps) {
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false)

  const toggleIndicator = (key: keyof IndicatorConfig) => {
    onIndicatorsChange({
      ...indicators,
      [key]: !indicators[key],
    })
  }

  return (
    <div className="relative flex items-center gap-3 px-4 py-2 border-b border-white/5">
      {/* Symbol Selector */}
      <div className="w-56">
        <SymbolSearch
          value={symbol}
          onChange={onSymbolChange}
          className={cn(isLoading && 'pointer-events-none opacity-60')}
        />
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

      <div className="w-px h-4 bg-white/10" />

      <button
        type="button"
        onClick={() => setShowIndicatorPanel((prev) => !prev)}
        className={cn(
          'px-2 py-1 text-xs rounded transition-all',
          showIndicatorPanel
            ? 'bg-emerald-500/15 text-emerald-500'
            : 'text-white/30 hover:text-white/50',
        )}
      >
        Indicators
      </button>

      {/* Loading indicator */}
      {isLoading && (
        <div className="ml-auto">
          <div className="w-3 h-3 border border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      )}

      {showIndicatorPanel && (
        <div className="absolute left-4 top-full z-30 mt-2 w-64 rounded-xl border border-white/10 bg-[#0a0f0d] p-3 shadow-2xl">
          <p className="mb-2 text-[11px] font-medium text-white/70">Chart Overlays</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { key: 'ema8' as const, label: 'EMA 8' },
              { key: 'ema21' as const, label: 'EMA 21' },
              { key: 'vwap' as const, label: 'VWAP' },
              { key: 'openingRange' as const, label: 'OR Box' },
              { key: 'rsi' as const, label: 'RSI' },
              { key: 'macd' as const, label: 'MACD' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleIndicator(item.key)}
                className={cn(
                  'rounded border px-2 py-1 text-left',
                  indicators[item.key]
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/5 text-white/45 hover:text-white/70',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
