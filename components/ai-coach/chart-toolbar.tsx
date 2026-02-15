'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ChartTimeframe } from '@/lib/api/ai-coach'
import { SymbolSearch } from './symbol-search'
import type { IndicatorConfig } from './chart-indicators'
import {
  DEFAULT_LEVEL_VISIBILITY,
  LEVEL_GROUP_LABELS,
  LEVEL_GROUP_ORDER,
  type LevelGroupId,
  type LevelVisibilityConfig,
} from './chart-level-groups'

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
  levelVisibility: LevelVisibilityConfig
  onLevelVisibilityChange: (next: LevelVisibilityConfig) => void
  levelCounts: Record<LevelGroupId, number>
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
  levelVisibility,
  onLevelVisibilityChange,
  levelCounts,
  isLoading,
}: ChartToolbarProps) {
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false)
  const [showLevelPanel, setShowLevelPanel] = useState(false)

  const toggleIndicator = (key: keyof IndicatorConfig) => {
    onIndicatorsChange({
      ...indicators,
      [key]: !indicators[key],
    })
  }

  const toggleLevelGroup = (group: LevelGroupId) => {
    onLevelVisibilityChange({
      ...levelVisibility,
      [group]: !levelVisibility[group],
    })
  }

  const setAllLevelGroups = (enabled: boolean) => {
    const next = LEVEL_GROUP_ORDER.reduce((acc, group) => {
      acc[group] = enabled
      return acc
    }, {} as LevelVisibilityConfig)
    onLevelVisibilityChange(next)
  }

  const disabledLevelCount = LEVEL_GROUP_ORDER.reduce((sum, group) => {
    if (levelVisibility[group]) return sum
    return sum + levelCounts[group]
  }, 0)

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
        onClick={() => {
          setShowIndicatorPanel((prev) => !prev)
          setShowLevelPanel(false)
        }}
        className={cn(
          'px-2 py-1 text-xs rounded transition-all',
          showIndicatorPanel
            ? 'bg-emerald-500/15 text-emerald-500'
            : 'text-white/30 hover:text-white/50',
        )}
      >
        Indicators
      </button>

      <button
        type="button"
        onClick={() => {
          setShowLevelPanel((prev) => !prev)
          setShowIndicatorPanel(false)
        }}
        className={cn(
          'px-2 py-1 text-xs rounded transition-all',
          showLevelPanel
            ? 'bg-emerald-500/15 text-emerald-500'
            : disabledLevelCount > 0
              ? 'text-amber-300 hover:text-amber-200'
              : 'text-white/30 hover:text-white/50',
        )}
      >
        Levels
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

      {showLevelPanel && (
        <div className="absolute left-4 top-full z-30 mt-2 w-72 rounded-xl border border-white/10 bg-[#0a0f0d] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-medium text-white/70">Level Visibility</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAllLevelGroups(true)}
                className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60 hover:text-white/85"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setAllLevelGroups(false)}
                className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60 hover:text-white/85"
              >
                None
              </button>
              <button
                type="button"
                onClick={() => onLevelVisibilityChange(DEFAULT_LEVEL_VISIBILITY)}
                className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60 hover:text-white/85"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {LEVEL_GROUP_ORDER.map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => toggleLevelGroup(group)}
                className={cn(
                  'rounded border px-2 py-1 text-left',
                  levelVisibility[group]
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/5 text-white/45 hover:text-white/70',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{LEVEL_GROUP_LABELS[group]}</span>
                  <span className="text-[10px] text-white/45">{levelCounts[group]}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
