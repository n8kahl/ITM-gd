'use client'

import { type IndicatorConfig } from '@/components/ai-coach/chart-indicators'
import { Activity, BarChart3, Square, TrendingUp, Waves } from 'lucide-react'
import type { ReactNode } from 'react'

interface IndicatorToolbarProps {
  indicators: IndicatorConfig
  onToggle: (key: keyof IndicatorConfig) => void
}

interface ToggleButton {
  key: keyof IndicatorConfig
  label: string
  icon: ReactNode
  color: string
}

const TOGGLE_BUTTONS: ToggleButton[] = [
  { key: 'ema8', label: 'EMA 8', icon: <TrendingUp className="h-3.5 w-3.5" />, color: '#38bdf8' },
  { key: 'ema21', label: 'EMA 21', icon: <TrendingUp className="h-3.5 w-3.5" />, color: '#fbbf24' },
  { key: 'vwap', label: 'VWAP', icon: <Activity className="h-3.5 w-3.5" />, color: '#facc15' },
  { key: 'openingRange', label: 'OR', icon: <Square className="h-3.5 w-3.5" />, color: '#a78bfa' },
  { key: 'rsi', label: 'RSI', icon: <BarChart3 className="h-3.5 w-3.5" />, color: '#f472b6' },
  { key: 'macd', label: 'MACD', icon: <Waves className="h-3.5 w-3.5" />, color: '#34d399' },
]

export function IndicatorToolbar({ indicators, onToggle }: IndicatorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-white/40">
        Indicators
      </span>
      {TOGGLE_BUTTONS.map(({ key, label, icon, color }) => {
        const active = indicators[key]
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
              active
                ? 'bg-emerald-500/20 text-white shadow-sm shadow-emerald-500/10'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
            }`}
            style={active ? { borderLeft: `2px solid ${color}` } : undefined}
          >
            {icon}
            {label}
          </button>
        )
      })}
    </div>
  )
}
