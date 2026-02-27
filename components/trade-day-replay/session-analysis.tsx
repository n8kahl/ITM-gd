'use client'

import { cn } from '@/lib/utils'
import type { ReplayPayload } from '@/lib/trade-day-replay/types'
import { TradeCard } from './trade-card'

interface SessionAnalysisProps {
  payload: ReplayPayload
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function formatPercent(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) {
    return 'n/a'
  }

  return `${value.toFixed(1)}%`
}

function formatCount(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) {
    return 'n/a'
  }

  return String(Math.max(0, Math.round(value)))
}

function formatSessionDuration(minutes: number | null | undefined): string {
  if (!isFiniteNumber(minutes) || minutes < 0) {
    return 'n/a'
  }

  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const remainderMinutes = rounded % 60

  if (hours <= 0) return `${remainderMinutes}m`
  if (remainderMinutes <= 0) return `${hours}h`
  return `${hours}h ${remainderMinutes}m`
}

function formatBestWorstTrade(value: { index: number; pctReturn: number } | null): string {
  if (!value || !isFiniteNumber(value.index) || !isFiniteNumber(value.pctReturn)) {
    return 'n/a'
  }

  return `Trade ${Math.round(value.index)} (${value.pctReturn >= 0 ? '+' : ''}${value.pctReturn.toFixed(2)}%)`
}

interface StatTileProps {
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative'
}

function StatTile({ label, value, tone = 'default' }: StatTileProps) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[11px] uppercase tracking-[0.1em] text-white/60">{label}</p>
      <p
        className={cn(
          'mt-1 text-sm font-semibold',
          tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-red-300' : 'text-ivory',
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function SessionAnalysis({ payload }: SessionAnalysisProps) {
  const stats = payload.stats
  const tradeCount = payload.trades.length
  const winRateTone = isFiniteNumber(stats.winRate)
    ? stats.winRate >= 50 ? 'positive' : 'negative'
    : 'default'

  return (
    <section className="mt-4 space-y-3">
      <div className="rounded-lg border border-white/10 bg-black/20 p-4 lg:p-5">
        <h3 className="text-sm font-semibold text-ivory">Session Analysis</h3>
        <p className="mt-1 text-xs text-white/60">Summary generated from replay payload stats.</p>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StatTile label="Win Rate" value={formatPercent(stats.winRate)} tone={winRateTone} />
          <StatTile
            label="Winners / Losers"
            value={`${formatCount(stats.winners)} / ${formatCount(stats.losers)}`}
          />
          <StatTile label="Total Trades" value={formatCount(stats.totalTrades ?? tradeCount)} />
          <StatTile label="Session Duration" value={formatSessionDuration(stats.sessionDurationMin)} />
          <StatTile label="Best Trade" value={formatBestWorstTrade(stats.bestTrade)} tone="positive" />
          <StatTile label="Worst Trade" value={formatBestWorstTrade(stats.worstTrade)} tone="negative" />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ivory">Trade Cards ({tradeCount})</h3>

        {tradeCount > 0 ? (
          <div className="space-y-3">
            {payload.trades.map((trade) => (
              <TradeCard
                key={`${trade.tradeIndex}-${trade.entryTimestamp}-${trade.contract?.strike ?? 'strike'}`}
                trade={trade}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/70">
            No trades were parsed from this transcript.
          </div>
        )}
      </div>
    </section>
  )
}
