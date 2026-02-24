'use client'

import { useState } from 'react'
import type { ChartTimeframe } from '@/lib/api/ai-coach'
import type { IndicatorConfig } from './chart-indicators'
import type { AICoachPreferences } from './preferences'

interface PreferencesPanelProps {
  value: AICoachPreferences
  onChange: (next: AICoachPreferences) => void
  onReset: () => void
}

const CHART_TIMEFRAMES: ChartTimeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D']
const STRIKE_RANGES: Array<5 | 10 | 15 | 20 | 30> = [5, 10, 15, 20, 30]
const ORB_WINDOWS: Array<5 | 15 | 30> = [5, 15, 30]

const INDICATOR_KEYS: Array<{ key: keyof IndicatorConfig; label: string }> = [
  { key: 'ema8', label: 'EMA 8' },
  { key: 'ema21', label: 'EMA 21' },
  { key: 'vwap', label: 'VWAP' },
  { key: 'openingRange', label: 'Opening Range Box' },
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
]

export function PreferencesPanel({ value, onChange, onReset }: PreferencesPanelProps) {
  const [watchlistDraft, setWatchlistDraft] = useState('')
  const setPreference = <K extends keyof AICoachPreferences>(key: K, nextValue: AICoachPreferences[K]) => {
    onChange({
      ...value,
      [key]: nextValue,
    })
  }

  const addWatchlistSymbol = () => {
    const candidate = watchlistDraft.trim().toUpperCase()
    if (!/^[A-Z0-9._:-]{1,10}$/.test(candidate)) return
    if (value.defaultWatchlist.includes(candidate)) {
      setWatchlistDraft('')
      return
    }
    setPreference('defaultWatchlist', [...value.defaultWatchlist, candidate].slice(0, 20))
    setWatchlistDraft('')
  }

  const removeWatchlistSymbol = (symbol: string) => {
    setPreference('defaultWatchlist', value.defaultWatchlist.filter((item) => item !== symbol))
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Workflow Preferences</h3>
          <p className="text-xs text-white/45">Saved locally for this browser profile.</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60 hover:text-white/80"
        >
          Reset Defaults
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <h4 className="text-xs font-medium text-white/80 mb-3">Risk & Execution</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-white/55">
              Risk Per Trade (%)
              <input
                type="number"
                min={0.25}
                max={5}
                step={0.25}
                value={value.riskPerTradePct}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (!Number.isFinite(next)) return
                  setPreference('riskPerTradePct', Math.max(0.25, Math.min(5, Number(next.toFixed(2)))))
                }}
                className="mt-1 block w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
              />
            </label>

            <label className="text-xs text-white/55">
              Opening Range Window
              <select
                value={value.orbMinutes}
                onChange={(event) => setPreference('orbMinutes', Number(event.target.value) as 5 | 15 | 30)}
                className="mt-1 block w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
              >
                {ORB_WINDOWS.map((windowMinutes) => (
                  <option key={windowMinutes} value={windowMinutes}>
                    {windowMinutes} minutes
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <h4 className="text-xs font-medium text-white/80 mb-3">Chart Defaults</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-white/55">
              Default Timeframe
              <select
                value={value.defaultChartTimeframe}
                onChange={(event) => setPreference('defaultChartTimeframe', event.target.value as ChartTimeframe)}
                className="mt-1 block w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
              >
                {CHART_TIMEFRAMES.map((timeframe) => (
                  <option key={timeframe} value={timeframe}>
                    {timeframe}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {INDICATOR_KEYS.map((indicator) => (
              <label
                key={indicator.key}
                className="flex items-center justify-between rounded border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white/70"
              >
                {indicator.label}
                <input
                  type="checkbox"
                  checked={Boolean(value.defaultIndicators[indicator.key])}
                  onChange={(event) => {
                    setPreference('defaultIndicators', {
                      ...value.defaultIndicators,
                      [indicator.key]: event.target.checked,
                    })
                  }}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <h4 className="text-xs font-medium text-white/80 mb-3">Options Defaults</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-white/55">
              Default Strike Range
              <select
                value={value.defaultOptionsStrikeRange}
                onChange={(event) => setPreference('defaultOptionsStrikeRange', Number(event.target.value) as 5 | 10 | 15 | 20 | 30)}
                className="mt-1 block w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
              >
                {STRIKE_RANGES.map((range) => (
                  <option key={range} value={range}>
                    {range} strikes
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="flex items-center justify-between rounded border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white/70">
              Default GEX Widget
              <input
                type="checkbox"
                checked={value.defaultShowGex}
                onChange={(event) => setPreference('defaultShowGex', event.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-500"
              />
            </label>
            <label className="flex items-center justify-between rounded border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white/70">
              Default 0DTE/IV Widgets
              <input
                type="checkbox"
                checked={value.defaultShowVolAnalytics}
                onChange={(event) => setPreference('defaultShowVolAnalytics', event.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-500"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <h4 className="text-xs font-medium text-white/80 mb-3">Workflow</h4>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex items-center justify-between rounded border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white/70">
              Auto-sync symbols between views
              <input
                type="checkbox"
                checked={value.autoSyncWorkflowSymbol}
                onChange={(event) => setPreference('autoSyncWorkflowSymbol', event.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-500"
              />
            </label>
            <label className="flex items-center justify-between rounded border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white/70">
              Enable notifications
              <input
                type="checkbox"
                checked={value.notificationsEnabled}
                onChange={(event) => setPreference('notificationsEnabled', event.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-500"
              />
            </label>
          </div>

          <div className="mt-3 rounded border border-white/10 bg-black/20 p-2.5">
            <p className="text-[11px] text-white/60 mb-2">Default Watchlist</p>
            <div className="mb-2 flex items-center gap-1.5">
              <input
                value={watchlistDraft}
                onChange={(event) => setWatchlistDraft(event.target.value.toUpperCase().replace(/[^A-Z0-9._:-]/g, ''))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addWatchlistSymbol()
                  }
                }}
                placeholder="Add symbol (AAPL, SPX...)"
                className="h-8 flex-1 rounded border border-white/10 bg-black/30 px-2 text-xs text-white placeholder:text-white/35 focus:border-emerald-500/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={addWatchlistSymbol}
                className="h-8 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-[11px] text-emerald-300 hover:bg-emerald-500/15"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {value.defaultWatchlist.map((symbol) => (
                <span
                  key={symbol}
                  className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/75"
                >
                  {symbol}
                  <button
                    type="button"
                    onClick={() => removeWatchlistSymbol(symbol)}
                    className="text-white/40 hover:text-red-300"
                    aria-label={`Remove ${symbol} from watchlist`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
