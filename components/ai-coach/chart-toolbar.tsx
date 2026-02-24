'use client'

import { useMemo, useState } from 'react'
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
  watchlist: string[]
  timeframe: ChartTimeframe
  onSymbolChange: (symbol: string) => void
  onWatchlistChange: (symbols: string[]) => void
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
const MAX_WATCHLIST_SYMBOLS = 20
const WATCHLIST_SYMBOL_REGEX = /^[A-Z0-9._:-]{1,10}$/

// ============================================
// COMPONENT
// ============================================

export function ChartToolbar({
  symbol,
  watchlist,
  timeframe,
  onSymbolChange,
  onWatchlistChange,
  onTimeframeChange,
  indicators,
  onIndicatorsChange,
  levelVisibility,
  onLevelVisibilityChange,
  levelCounts,
  isLoading,
}: ChartToolbarProps) {
  const normalizedWatchlist = useMemo(() => {
    const deduped: string[] = []
    const seen = new Set<string>()
    for (const raw of watchlist) {
      const candidate = String(raw || '').trim().toUpperCase()
      if (!WATCHLIST_SYMBOL_REGEX.test(candidate) || seen.has(candidate)) continue
      seen.add(candidate)
      deduped.push(candidate)
      if (deduped.length >= MAX_WATCHLIST_SYMBOLS) break
    }
    return deduped
  }, [watchlist])

  const [watchlistDraft, setWatchlistDraft] = useState('')
  const [showWatchlistPanel, setShowWatchlistPanel] = useState(false)
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false)
  const [showLevelPanel, setShowLevelPanel] = useState(false)

  const addSymbolToWatchlist = (input: string) => {
    const candidate = input.trim().toUpperCase()
    if (!WATCHLIST_SYMBOL_REGEX.test(candidate)) return
    if (normalizedWatchlist.includes(candidate)) {
      onSymbolChange(candidate)
      setWatchlistDraft('')
      return
    }
    const next = [...normalizedWatchlist, candidate].slice(0, MAX_WATCHLIST_SYMBOLS)
    onWatchlistChange(next)
    onSymbolChange(candidate)
    setWatchlistDraft('')
  }

  const removeSymbolFromWatchlist = (target: string) => {
    const next = normalizedWatchlist.filter((item) => item !== target)
    onWatchlistChange(next)
    if (target === symbol && next.length > 0) {
      onSymbolChange(next[0])
    }
  }

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
          className={cn(isLoading && 'opacity-80')}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-white/10" />

      <button
        type="button"
        onClick={() => {
          setShowWatchlistPanel((prev) => !prev)
          setShowIndicatorPanel(false)
          setShowLevelPanel(false)
        }}
        className={cn(
          'px-2 py-1 text-xs rounded transition-all',
          showWatchlistPanel
            ? 'bg-emerald-500/15 text-emerald-500'
            : 'text-white/30 hover:text-white/50',
        )}
      >
        Manage Watchlist ({normalizedWatchlist.length})
      </button>

      <div className="hidden xl:flex items-center gap-1">
        {normalizedWatchlist.slice(0, 6).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onSymbolChange(item)}
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] transition-colors',
              item === symbol
                ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-200'
                : 'border-white/10 bg-white/5 text-white/50 hover:text-white/75',
            )}
            aria-label={`Switch chart symbol to ${item}`}
          >
            {item}
          </button>
        ))}
      </div>

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
          setShowWatchlistPanel(false)
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
          setShowWatchlistPanel(false)
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

      {showWatchlistPanel && (
        <div className="absolute left-4 top-full z-30 mt-2 w-80 rounded-xl border border-white/10 bg-[#0a0f0d] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-medium text-white/70">Watchlist</p>
            <span className="text-[10px] text-white/40">{normalizedWatchlist.length}/{MAX_WATCHLIST_SYMBOLS}</span>
          </div>
          <p className="mb-2 text-[10px] text-white/45">Click any symbol to load it on chart. Add or remove symbols below.</p>
          <div className="mb-2 flex items-center gap-1.5">
            <input
              value={watchlistDraft}
              onChange={(event) => setWatchlistDraft(event.target.value.toUpperCase().replace(/[^A-Z0-9._:-]/g, ''))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addSymbolToWatchlist(watchlistDraft)
                }
              }}
              placeholder="Add symbol (AAPL, SPX...)"
              className="h-8 flex-1 rounded border border-white/10 bg-black/30 px-2 text-xs text-white placeholder:text-white/35 focus:border-emerald-500/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => addSymbolToWatchlist(watchlistDraft)}
              className="h-8 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-[11px] text-emerald-300 hover:bg-emerald-500/15"
            >
              Add
            </button>
          </div>
          <div className="max-h-44 space-y-1 overflow-y-auto pr-0.5">
            {normalizedWatchlist.length === 0 && (
              <p className="rounded border border-white/10 bg-white/[0.03] px-2 py-2 text-[11px] text-white/50">
                Add symbols to build your watchlist.
              </p>
            )}
            {normalizedWatchlist.map((item) => (
              <div
                key={item}
                className={cn(
                  'flex items-center justify-between rounded border px-2 py-1.5',
                  item === symbol
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-white/10 bg-white/[0.03]',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSymbolChange(item)}
                  className={cn(
                    'text-left text-xs',
                    item === symbol ? 'text-emerald-300' : 'text-white/75 hover:text-white',
                  )}
                >
                  {item}
                </button>
                <button
                  type="button"
                  onClick={() => removeSymbolFromWatchlist(item)}
                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50 hover:text-red-300"
                  aria-label={`Remove ${item} from watchlist`}
                >
                  Remove
                </button>
              </div>
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
