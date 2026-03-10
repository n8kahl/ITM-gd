'use client'

import { useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  SwingSniperBoardIdea,
  SwingSniperStructureStrategy,
  SwingSniperWatchlistPayload,
} from '@/lib/swing-sniper/types'

interface OpportunityBoardProps {
  ideas: SwingSniperBoardIdea[]
  loading: boolean
  activeSymbol: string | null
  filters: SwingSniperWatchlistPayload['filters']
  savingPreferences: boolean
  onPresetChange: (preset: SwingSniperWatchlistPayload['filters']['preset']) => void
  onRiskModeChange: (riskMode: SwingSniperWatchlistPayload['filters']['riskMode']) => void
  onSwingWindowChange: (swingWindow: SwingSniperWatchlistPayload['filters']['swingWindow']) => void
  onMinScoreChange: (minScore: number) => void
  onToggleSetup: (setup: SwingSniperStructureStrategy) => void
  onSavePreferences: () => void
  onSelect: (symbol: string) => void
}

const SETUP_OPTIONS: Array<{
  value: SwingSniperStructureStrategy
  label: string
  tier: 'defined' | 'advanced'
}> = [
  { value: 'long_call', label: 'Long Call', tier: 'advanced' },
  { value: 'long_put', label: 'Long Put', tier: 'advanced' },
  { value: 'long_straddle', label: 'Long Straddle', tier: 'advanced' },
  { value: 'long_strangle', label: 'Long Strangle', tier: 'advanced' },
  { value: 'call_debit_spread', label: 'Call Debit Spread', tier: 'defined' },
  { value: 'put_debit_spread', label: 'Put Debit Spread', tier: 'defined' },
  { value: 'call_calendar', label: 'Call Calendar', tier: 'defined' },
  { value: 'put_calendar', label: 'Put Calendar', tier: 'defined' },
  { value: 'call_diagonal', label: 'Call Diagonal', tier: 'defined' },
  { value: 'put_diagonal', label: 'Put Diagonal', tier: 'defined' },
  { value: 'call_butterfly', label: 'Call Butterfly', tier: 'defined' },
  { value: 'put_butterfly', label: 'Put Butterfly', tier: 'defined' },
]

function orcTone(score: number): string {
  if (score >= 80) return 'border-emerald-400/45 bg-emerald-500/15 text-emerald-100'
  if (score >= 60) return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90'
  return 'border-white/10 bg-white/[0.04] text-white/75'
}

function filterIdeas(
  ideas: SwingSniperBoardIdea[],
  filters: SwingSniperWatchlistPayload['filters'],
): SwingSniperBoardIdea[] {
  return ideas.filter((idea) => {
    if (idea.orc_score < filters.minScore) return false

    if (filters.preset === 'all') return true
    if (filters.preset === 'long_vol') return idea.view === 'Long vol'
    if (filters.preset === 'short_vol') return idea.view === 'Short vol'
    if (filters.preset === 'catalyst_dense') return (idea.window_days ?? 99) <= 10
    return (idea.window_days ?? 99) <= 7
  })
}

export function OpportunityBoard({
  ideas,
  loading,
  activeSymbol,
  filters,
  savingPreferences,
  onPresetChange,
  onRiskModeChange,
  onSwingWindowChange,
  onMinScoreChange,
  onToggleSetup,
  onSavePreferences,
  onSelect,
}: OpportunityBoardProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  const filteredIdeas = useMemo(() => filterIdeas(ideas, filters), [ideas, filters])

  return (
    <section className="glass-card-heavy rounded-2xl border border-white/10 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne">Signal Board</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by vol mispricing + catalyst density + liquidity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] transition-colors',
              settingsOpen
                ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
                : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]',
            )}
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Risk settings
          </button>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
            {ideas.length} live
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ['all', 'ALL'],
          ['long_vol', 'LONG VOL'],
          ['short_vol', 'SHORT VOL'],
          ['catalyst_dense', 'CATALYST DENSE'],
          ['seven_day', '7-DAY'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onPresetChange(value as SwingSniperWatchlistPayload['filters']['preset'])}
            className={cn(
              'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] transition-colors',
              filters.preset === value
                ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
                : 'border-white/10 bg-transparent text-white/70 hover:bg-white/[0.06]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {settingsOpen ? (
        <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Risk mode</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onRiskModeChange('defined_risk_only')}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] transition-colors',
                  filters.riskMode === 'defined_risk_only'
                    ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
                    : 'border-white/10 text-white/70 hover:bg-white/[0.06]',
                )}
              >
                Defined risk only
              </button>
              <button
                type="button"
                onClick={() => onRiskModeChange('naked_allowed')}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] transition-colors',
                  filters.riskMode === 'naked_allowed'
                    ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
                    : 'border-white/10 text-white/70 hover:bg-white/[0.06]',
                )}
              >
                Include naked / single-leg
              </button>
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Swing window</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                ['seven_to_fourteen', '7-14D'],
                ['fourteen_to_thirty', '14-30D'],
                ['all', 'All expiries'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onSwingWindowChange(value as SwingSniperWatchlistPayload['filters']['swingWindow'])}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] transition-colors',
                    filters.swingWindow === value
                      ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
                      : 'border-white/10 text-white/70 hover:bg-white/[0.06]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Minimum ORC score</p>
              <p className="font-mono text-xs text-white/80">{filters.minScore}</p>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={filters.minScore}
              onChange={(event) => onMinScoreChange(Number(event.currentTarget.value))}
              className="mt-2 w-full accent-emerald-500"
            />
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Setup types (multi-select)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SETUP_OPTIONS.map((option) => {
                const checked = filters.preferredSetups.includes(option.value)
                const disabled = filters.riskMode === 'defined_risk_only' && option.tier === 'advanced'

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => !disabled && onToggleSetup(option.value)}
                    disabled={disabled}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      checked
                        ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
                        : 'border-white/10 text-white/75 hover:bg-white/[0.06]',
                      disabled && 'cursor-not-allowed border-white/5 text-white/35 hover:bg-transparent',
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onSavePreferences}
            disabled={savingPreferences}
            className="rounded-full border border-emerald-500/35 bg-emerald-500/12 px-4 py-1.5 text-xs uppercase tracking-[0.14em] text-emerald-100 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {savingPreferences ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      ) : null}

      <div className="mt-4 max-h-[72vh] space-y-3 overflow-y-auto pr-1">
        {loading
          ? Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="h-6 w-24 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-4 w-5/6 animate-pulse rounded bg-white/5" />
              <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-white/5" />
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="h-14 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
                <div className="h-14 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
                <div className="h-14 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
              </div>
            </div>
          ))
          : filteredIdeas.map((idea) => (
            <button
              key={idea.symbol}
              type="button"
              onClick={() => onSelect(idea.symbol)}
              className={cn(
                'w-full rounded-2xl border bg-white/[0.03] p-4 text-left transition-all duration-150',
                activeSymbol === idea.symbol
                  ? 'border-emerald-500/35 bg-emerald-500/[0.08] shadow-[0_0_0_1px_rgba(16,185,129,0.18)]'
                  : 'border-white/10 hover:-translate-y-[2px] hover:border-emerald-500/25 hover:shadow-[0_12px_28px_rgba(16,185,129,0.16)]',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-2xl font-semibold tracking-tight text-white">{idea.symbol}</h3>
                <span className={cn('rounded-full border px-2.5 py-1 font-mono text-xs', orcTone(idea.orc_score))}>
                  ORC {idea.orc_score}
                </span>
              </div>

              <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{idea.blurb}</p>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-[#050505] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">View</p>
                  <p className="mt-1 text-sm font-medium text-white">{idea.view}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#050505] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Catalyst</p>
                  <p className="mt-1 text-sm font-medium text-white">{idea.catalyst_label}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#050505] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Window</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {idea.window_days == null ? '--' : `${idea.window_days}D`}
                  </p>
                </div>
              </div>
            </button>
          ))}

        {!loading && filteredIdeas.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
            No ideas match this filter yet.
          </div>
        ) : null}
      </div>
    </section>
  )
}
