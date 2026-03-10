'use client'

import { cn } from '@/lib/utils'
import type { SwingSniperBoardIdea, SwingSniperWatchlistPayload } from '@/lib/swing-sniper/types'

interface OpportunityBoardProps {
  ideas: SwingSniperBoardIdea[]
  loading: boolean
  activeSymbol: string | null
  preset: SwingSniperWatchlistPayload['filters']['preset']
  onFilterChange: (preset: SwingSniperWatchlistPayload['filters']['preset']) => void
  onSelect: (symbol: string) => void
}

function orcTone(score: number): string {
  if (score >= 80) return 'border-emerald-400/45 bg-emerald-500/15 text-emerald-100'
  if (score >= 60) return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90'
  return 'border-white/10 bg-white/[0.04] text-white/75'
}

function filterIdeas(
  ideas: SwingSniperBoardIdea[],
  preset: SwingSniperWatchlistPayload['filters']['preset'],
): SwingSniperBoardIdea[] {
  return ideas.filter((idea) => {
    if (preset === 'all') return true
    if (preset === 'long_vol') return idea.view === 'Long vol'
    if (preset === 'short_vol') return idea.view === 'Short vol'
    if (preset === 'catalyst_dense') return (idea.window_days ?? 99) <= 10
    return (idea.window_days ?? 99) <= 7
  })
}

export function OpportunityBoard({
  ideas,
  loading,
  activeSymbol,
  preset,
  onFilterChange,
  onSelect,
}: OpportunityBoardProps) {
  const filteredIdeas = filterIdeas(ideas, preset)

  return (
    <section className="glass-card-heavy rounded-2xl border border-white/10 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne">Signal Board</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by vol mispricing + catalyst density + liquidity
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
          {ideas.length} live
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
            onClick={() => onFilterChange(value as SwingSniperWatchlistPayload['filters']['preset'])}
            className={cn(
              'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] transition-colors',
              preset === value
                ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
                : 'border-white/10 bg-transparent text-white/70 hover:bg-white/[0.06]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

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
