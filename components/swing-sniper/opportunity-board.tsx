'use client'

import { useMemo, useState } from 'react'
import { BookmarkPlus, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  SwingSniperBoardIdea,
  SwingSniperWatchlistPayload,
} from '@/lib/swing-sniper/types'

interface OpportunityBoardProps {
  ideas: SwingSniperBoardIdea[]
  loading: boolean
  activeSymbol: string | null
  filters: SwingSniperWatchlistPayload['filters']
  savedSymbols: string[]
  savingSymbol: string | null
  onPresetChange: (preset: SwingSniperWatchlistPayload['filters']['preset']) => void
  onOpenMandate: () => void
  onQuickSave: (idea: SwingSniperBoardIdea) => void
  onSelect: (symbol: string) => void
}

type BoardSort = 'best_now' | 'nearest_catalyst' | 'highest_liquidity'

function orcTone(score: number): string {
  if (score >= 80) return 'border-emerald-400/45 bg-emerald-500/15 text-emerald-100'
  if (score >= 60) return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90'
  return 'border-white/10 bg-white/[0.04] text-white/75'
}

function viewTone(view: SwingSniperBoardIdea['view']): string {
  if (view === 'Long vol') return 'bg-emerald-400'
  if (view === 'Short vol') return 'bg-champagne'
  return 'bg-white/45'
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

function sortIdeas(ideas: SwingSniperBoardIdea[], sortMode: BoardSort): SwingSniperBoardIdea[] {
  const sorted = [...ideas]

  if (sortMode === 'nearest_catalyst') {
    return sorted.sort((left, right) => {
      const leftWindow = left.window_days ?? Number.MAX_SAFE_INTEGER
      const rightWindow = right.window_days ?? Number.MAX_SAFE_INTEGER
      if (leftWindow !== rightWindow) return leftWindow - rightWindow
      return right.orc_score - left.orc_score
    })
  }

  if (sortMode === 'highest_liquidity') {
    return sorted.sort((left, right) => {
      if (right.factors.liquidity !== left.factors.liquidity) {
        return right.factors.liquidity - left.factors.liquidity
      }
      return right.orc_score - left.orc_score
    })
  }

  return sorted.sort((left, right) => right.orc_score - left.orc_score)
}

export function OpportunityBoard({
  ideas,
  loading,
  activeSymbol,
  filters,
  savedSymbols,
  savingSymbol,
  onPresetChange,
  onOpenMandate,
  onQuickSave,
  onSelect,
}: OpportunityBoardProps) {
  const [sortMode, setSortMode] = useState<BoardSort>('best_now')

  const filteredIdeas = useMemo(() => {
    return sortIdeas(filterIdeas(ideas, filters), sortMode)
  }, [filters, ideas, sortMode])

  return (
    <section className="glass-card-heavy rounded-[28px] border border-white/10 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne">Top Opportunities</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Ranked for your mandate across mispricing, catalyst timing, and liquidity.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenMandate}
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.14em] text-white/70 transition-colors hover:bg-white/[0.08]"
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Mandate
          </button>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
            {filteredIdeas.length} shown
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ['all', 'ALL'],
          ['long_vol', 'LONG VOL'],
          ['short_vol', 'SHORT VOL'],
          ['catalyst_dense', 'CATALYST'],
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Sort</p>
        {[
          ['best_now', 'Best now'],
          ['nearest_catalyst', 'Nearest catalyst'],
          ['highest_liquidity', 'Highest liquidity'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSortMode(value as BoardSort)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              sortMode === value
                ? 'border-white/15 bg-white/[0.08] text-white'
                : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 max-h-[74vh] space-y-3 overflow-y-auto pr-1">
        {loading
          ? Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="h-5 w-16 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-white/5" />
              <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-white/5" />
              <div className="mt-4 h-8 w-full animate-pulse rounded-2xl bg-white/5" />
            </div>
          ))
          : filteredIdeas.map((idea) => {
            const isSaved = savedSymbols.includes(idea.symbol)
            const isActive = activeSymbol === idea.symbol

            return (
              <article
                key={idea.symbol}
                className={cn(
                  'rounded-[24px] border bg-white/[0.03] p-4 transition-all duration-150',
                  isActive
                    ? 'border-emerald-500/35 bg-emerald-500/[0.08] shadow-[0_0_0_1px_rgba(16,185,129,0.18)]'
                    : 'border-white/10 hover:border-emerald-500/25 hover:bg-white/[0.05]',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => onSelect(idea.symbol)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full', viewTone(idea.view))} />
                      <h3 className="text-xl font-semibold tracking-tight text-white">{idea.symbol}</h3>
                      <span className={cn('rounded-full border px-2.5 py-0.5 font-mono text-[11px]', orcTone(idea.orc_score))}>
                        ORC {idea.orc_score}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-white/50">
                      <span>{idea.view}</span>
                      <span>{idea.catalyst_label}</span>
                      <span>{idea.window_days == null ? 'Flexible' : `${idea.window_days}D`}</span>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/80">{idea.blurb}</p>

                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/55">
                      <span>Vol {idea.factors.volatility}</span>
                      <span>Catalyst {idea.factors.catalyst}</span>
                      <span>Liquidity {idea.factors.liquidity}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onQuickSave(idea)}
                    disabled={isSaved || savingSymbol === idea.symbol}
                    className={cn(
                      'inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] transition-colors',
                      isSaved
                        ? 'cursor-default border-emerald-500/30 bg-emerald-500/12 text-emerald-100'
                        : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]',
                      savingSymbol === idea.symbol && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
                    {isSaved ? 'Saved' : savingSymbol === idea.symbol ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </article>
            )
          })}

        {!loading && filteredIdeas.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
            No ideas match the current mandate and board filter.
          </div>
        ) : null}
      </div>
    </section>
  )
}
