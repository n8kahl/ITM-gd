'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ReplayPayload } from '@/lib/trade-day-replay/types'
import { computeSessionGrade, type SessionGrade } from '@/lib/trade-day-replay/session-grader'
import { EquityCurve } from './equity-curve'
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

const GRADE_COLORS: Record<SessionGrade, string> = {
  A: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  B: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
  C: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  D: 'text-orange-300 border-orange-500/40 bg-orange-500/10',
  F: 'text-red-300 border-red-500/40 bg-red-500/10',
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

function collectFrequencies(items: string[]): Array<{ label: string; count: number }> {
  const map = new Map<string, number>()
  for (const item of items) {
    const trimmed = item.trim()
    if (trimmed) map.set(trimmed, (map.get(trimmed) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

export function SessionAnalysis({ payload }: SessionAnalysisProps) {
  const stats = payload.stats
  const tradeCount = payload.trades.length
  const winRateTone = isFiniteNumber(stats.winRate)
    ? stats.winRate >= 50 ? 'positive' : 'negative'
    : 'default'

  const gradeResult = useMemo(
    () => computeSessionGrade(stats, payload.trades),
    [stats, payload.trades],
  )

  const { topDrivers, topRisks } = useMemo(() => {
    const allDrivers: string[] = []
    const allRisks: string[] = []
    for (const trade of payload.trades) {
      if (trade.evaluation?.drivers) allDrivers.push(...trade.evaluation.drivers)
      if (trade.evaluation?.risks) allRisks.push(...trade.evaluation.risks)
    }
    return {
      topDrivers: collectFrequencies(allDrivers),
      topRisks: collectFrequencies(allRisks),
    }
  }, [payload.trades])

  return (
    <section className="mt-4 space-y-3">
      {/* Equity Curve */}
      <EquityCurve trades={payload.trades} />

      <div className="rounded-lg border border-white/10 bg-black/20 p-4 lg:p-5">
        <h3 className="text-sm font-semibold text-ivory">Session Analysis</h3>
        <p className="mt-1 text-xs text-white/60">Summary generated from replay payload stats.</p>

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {/* Session Grade Tile */}
          <div className={cn('rounded-md border p-3 text-center', GRADE_COLORS[gradeResult.grade])}>
            <p className="text-[11px] uppercase tracking-[0.1em] opacity-70">Session Grade</p>
            <p className="mt-1 font-[Playfair_Display] text-3xl font-bold">{gradeResult.grade}</p>
            <p className="mt-0.5 text-[10px] opacity-60">{gradeResult.score}/100</p>
          </div>

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

      {/* Drivers & Risks */}
      {(topDrivers.length > 0 || topRisks.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {topDrivers.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <h4 className="text-[11px] font-medium uppercase tracking-wider text-white/50">Top Drivers</h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {topDrivers.map(({ label, count }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300"
                  >
                    {label}
                    {count > 1 && <span className="text-[10px] text-emerald-400/60">x{count}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {topRisks.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <h4 className="text-[11px] font-medium uppercase tracking-wider text-white/50">Key Risks</h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {topRisks.map(({ label, count }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs text-red-300"
                  >
                    {label}
                    {count > 1 && <span className="text-[10px] text-red-400/60">x{count}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grade Factors */}
      {gradeResult.factors.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <h4 className="text-[11px] font-medium uppercase tracking-wider text-white/50">Grade Factors</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {gradeResult.factors.map((factor) => (
              <span
                key={factor}
                className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/60"
              >
                {factor}
              </span>
            ))}
          </div>
        </div>
      )}

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
