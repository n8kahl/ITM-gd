'use client'

import { Gauge, Radar, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SwingSniperOpportunity, SwingSniperWatchlistPayload } from '@/lib/swing-sniper/types'

interface OpportunityBoardProps {
  opportunities: SwingSniperOpportunity[]
  activeSymbol: string | null
  filters: SwingSniperWatchlistPayload['filters']
  onFilterChange: (preset: SwingSniperWatchlistPayload['filters']['preset']) => void
  onSelect: (symbol: string) => void
  notes?: string[]
  symbolsScanned?: number
}

function directionTone(direction: SwingSniperOpportunity['direction']): string {
  if (direction === 'long_vol') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
  if (direction === 'short_vol') return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  return 'border-white/10 bg-white/[0.04] text-white/70'
}

function filteredOpportunities(
  opportunities: SwingSniperOpportunity[],
  filters: SwingSniperWatchlistPayload['filters'],
): SwingSniperOpportunity[] {
  return opportunities.filter((opportunity) => {
    if (opportunity.score < filters.minScore) return false
    if (filters.preset === 'all') return true
    if (filters.preset === 'long_vol') return opportunity.direction === 'long_vol'
    if (filters.preset === 'short_vol') return opportunity.direction === 'short_vol'
    return opportunity.catalystDensity >= 3
  })
}

export function OpportunityBoard({
  opportunities,
  activeSymbol,
  filters,
  onFilterChange,
  onSelect,
  notes = [],
  symbolsScanned,
}: OpportunityBoardProps) {
  const filtered = filteredOpportunities(opportunities, filters)

  return (
    <section className="glass-card-heavy rounded-2xl border border-white/10 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">Signal Board</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked ideas where IV, realized movement, and event timing are most out of line.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
          {symbolsScanned ?? opportunities.length} live symbols
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ['all', 'All'],
          ['long_vol', 'Long Vol'],
          ['short_vol', 'Short Vol'],
          ['catalyst_dense', 'Catalyst Dense'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onFilterChange(value as SwingSniperWatchlistPayload['filters']['preset'])}
            className={cn(
              'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] transition-colors',
              filters.preset === value
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.07]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((opportunity) => (
          <button
            key={opportunity.symbol}
            type="button"
            onClick={() => onSelect(opportunity.symbol)}
            className={cn(
              'w-full rounded-2xl border p-4 text-left transition-colors',
              activeSymbol === opportunity.symbol
                ? 'border-emerald-500/30 bg-emerald-500/[0.08]'
                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold tracking-tight text-white">{opportunity.symbol}</h3>
                  {opportunity.saved ? (
                    <span className="rounded-full border border-champagne/30 bg-champagne/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-champagne">
                      Saved
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-white/85">{opportunity.setupLabel}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{opportunity.thesis}</p>
              </div>
              <div className="text-right">
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs text-emerald-200">
                  ORC {opportunity.score}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" />
                  Vol Gap
                </div>
                <p className="mt-1 font-medium text-white">
                  {opportunity.ivVsRvGap != null ? `${opportunity.ivVsRvGap >= 0 ? '+' : ''}${opportunity.ivVsRvGap.toFixed(1)} pts` : '--'}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <Radar className="h-3.5 w-3.5" />
                  Catalyst
                </div>
                <p className="mt-1 font-medium text-white">{opportunity.catalystLabel}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <Zap className="h-3.5 w-3.5" />
                  Expression
                </div>
                <p className="mt-1 font-medium text-white">{opportunity.expressionPreview}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" />
                  Liquidity
                </div>
                <p className="mt-1 font-medium text-white">
                  {opportunity.liquidityScore != null
                    ? `${opportunity.liquidityTier || 'unknown'} (${opportunity.liquidityScore.toFixed(0)})`
                    : 'unknown'}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={cn('rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em]', directionTone(opportunity.direction))}>
                {opportunity.direction.replace('_', ' ')}
              </span>
              {opportunity.reasons.slice(0, 2).map((reason) => (
                <span
                  key={`${opportunity.symbol}-${reason}`}
                  className="rounded-full border border-white/10 bg-[#050505] px-3 py-1 text-[11px] text-white/65"
                >
                  {reason}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {notes.length > 0 ? (
        <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-[#050505] p-4">
          {notes.map((note) => (
            <p key={note} className="text-sm leading-6 text-muted-foreground">{note}</p>
          ))}
        </div>
      ) : null}
    </section>
  )
}
