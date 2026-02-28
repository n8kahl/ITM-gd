'use client'

import { type IndicatorConfig } from '@/components/ai-coach/chart-indicators'
import { Activity, BarChart3, Minus, Square, TrendingUp, Waves } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'

interface IndicatorToolbarProps {
  indicators: IndicatorConfig
  levels: ReplayLevelVisibility
  priorDayAvailable: boolean
  onToggleIndicator: (key: ReplayIndicatorKey) => void
  onToggleLevel: (key: keyof ReplayLevelVisibility) => void
}

export interface ReplayLevelVisibility {
  priorDayLevels: boolean
  openingRange: boolean
}

export type ReplayIndicatorKey = Exclude<keyof IndicatorConfig, 'openingRange'>

interface ToggleButton<Key extends string> {
  key: Key
  label: string
  icon: ReactNode
  color: string
}

interface LegendItem {
  key: string
  label: string
  color: string
}

const INDICATOR_TOGGLE_BUTTONS: ToggleButton<ReplayIndicatorKey>[] = [
  { key: 'ema8', label: 'EMA 8', icon: <TrendingUp className="h-3.5 w-3.5" />, color: '#38bdf8' },
  { key: 'ema21', label: 'EMA 21', icon: <TrendingUp className="h-3.5 w-3.5" />, color: '#f59e0b' },
  { key: 'vwap', label: 'VWAP', icon: <Activity className="h-3.5 w-3.5" />, color: '#eab308' },
  { key: 'rsi', label: 'RSI', icon: <BarChart3 className="h-3.5 w-3.5" />, color: '#a78bfa' },
  { key: 'macd', label: 'MACD', icon: <Waves className="h-3.5 w-3.5" />, color: '#60a5fa' },
]

const LEVEL_TOGGLE_BUTTONS: ToggleButton<keyof ReplayLevelVisibility>[] = [
  { key: 'priorDayLevels', label: 'PDH/PDL', icon: <Minus className="h-3.5 w-3.5" />, color: '#10B981' },
  { key: 'openingRange', label: 'Opening Range', icon: <Square className="h-3.5 w-3.5" />, color: '#a78bfa' },
]

function renderToggleButton(
  key: string,
  label: string,
  icon: ReactNode,
  color: string,
  active: boolean,
  onClick: () => void,
  disabled: boolean,
) {
  return (
    <button
      key={key}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
        disabled
          ? 'cursor-not-allowed bg-white/[0.03] text-white/25'
          : active
            ? 'bg-emerald-500/20 text-white shadow-sm shadow-emerald-500/10'
            : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
      }`}
      style={active ? { borderLeft: `2px solid ${color}` } : undefined}
    >
      {icon}
      {label}
    </button>
  )
}

export function IndicatorToolbar({
  indicators,
  levels,
  priorDayAvailable,
  onToggleIndicator,
  onToggleLevel,
}: IndicatorToolbarProps) {
  const legendItems = useMemo<LegendItem[]>(() => {
    const items: LegendItem[] = []

    for (const indicator of INDICATOR_TOGGLE_BUTTONS) {
      if (indicators[indicator.key]) {
        items.push({
          key: indicator.key,
          label: indicator.label,
          color: indicator.color,
        })
      }
    }

    if (levels.openingRange) {
      items.push({
        key: 'opening-range',
        label: 'Opening Range',
        color: '#a78bfa',
      })
    }

    if (priorDayAvailable && levels.priorDayLevels) {
      items.push(
        { key: 'pdh', label: 'PDH', color: '#10B981' },
        { key: 'pdl', label: 'PDL', color: '#ef4444' },
      )
    }

    return items
  }, [indicators, levels.openingRange, levels.priorDayLevels, priorDayAvailable])

  return (
    <div
      className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
      data-testid="replay-toolbar"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-white/40">
          Indicators
        </span>
        {INDICATOR_TOGGLE_BUTTONS.map(({ key, label, icon, color }) => (
          renderToggleButton(
            key,
            label,
            icon,
            color,
            indicators[key],
            () => onToggleIndicator(key),
            false,
          )
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-white/40">
          Levels
        </span>
        {LEVEL_TOGGLE_BUTTONS.map(({ key, label, icon, color }) => {
          const disabled = key === 'priorDayLevels' && !priorDayAvailable
          const active = !disabled && levels[key]
          return renderToggleButton(
            key,
            label,
            icon,
            color,
            active,
            () => onToggleLevel(key),
            disabled,
          )
        })}
      </div>

      <div
        className="flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2"
        data-testid="replay-toolbar-legend"
      >
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-white/40">
          Legend
        </span>
        {legendItems.length > 0 ? (
          legendItems.map((item) => (
            <span
              key={item.key}
              className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/75"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))
        ) : (
          <span className="text-xs text-white/40">None active</span>
        )}
      </div>
    </div>
  )
}
