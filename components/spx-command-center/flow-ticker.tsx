'use client'

import { cn } from '@/lib/utils'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { InfoTip } from '@/components/ui/info-tip'

function ageSeconds(timestamp: string): number {
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) return 0
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000))
}

function relativeAge(timestamp: string): string {
  const seconds = ageSeconds(timestamp)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m`
}

function formatPremium(premium: number): string {
  const abs = Math.abs(premium)
  if (abs >= 1_000_000_000) return `$${(premium / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$${(premium / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(premium / 1_000).toFixed(0)}K`
  return `$${premium.toFixed(0)}`
}

export function FlowTicker() {
  const { flowEvents, spxPrice } = useSPXCommandCenter()
  const ranked = [...flowEvents]
    .map((event) => {
      const ageMin = Math.max(0.25, ageSeconds(event.timestamp) / 60)
      const score = event.premium / ageMin
      return { ...event, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  if (flowEvents.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/55">
        Flow feed is warming up.
      </div>
    )
  }

  const bullishPremium = ranked
    .filter((event) => event.direction === 'bullish')
    .reduce((sum, event) => sum + event.premium, 0)
  const bearishPremium = ranked
    .filter((event) => event.direction === 'bearish')
    .reduce((sum, event) => sum + event.premium, 0)
  const grossPremium = bullishPremium + bearishPremium
  const bullishShare = grossPremium > 0 ? (bullishPremium / grossPremium) * 100 : 50
  const netPremium = bullishPremium - bearishPremium
  const netBias = netPremium > 0 ? 'Bullish pressure' : netPremium < 0 ? 'Bearish pressure' : 'Balanced'

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <div className="mb-1 flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-[0.12em] text-white/50">Flow Pulse</p>
        <InfoTip label="How to read flow pulse" panelClassName="w-64">
          Ranking uses premium weighted by recency. Use the net bias and top rows as confirmation, not as standalone entry signals.
        </InfoTip>
      </div>

      <div className="mb-2 rounded-lg border border-white/10 bg-black/20 p-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${Math.max(5, Math.min(95, bullishShare))}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className="text-emerald-200">Bull {formatPremium(bullishPremium)}</span>
          <span className={cn('font-medium', netPremium >= 0 ? 'text-emerald-100' : 'text-rose-200')}>{netBias}</span>
          <span className="text-rose-200">Bear {formatPremium(bearishPremium)}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        {ranked.map((event, idx) => (
          <div
            key={event.id}
            className={cn(
              'grid grid-cols-[auto,1fr,auto] items-center gap-2 rounded-lg border px-2 py-1.5 text-xs',
              event.direction === 'bullish'
                ? 'border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-100'
                : 'border-rose-400/25 bg-rose-500/[0.08] text-rose-100',
            )}
          >
            <span className="text-[10px] text-white/55">#{idx + 1}</span>
            <div className="min-w-0">
              <p className="truncate">
                {event.symbol} {event.type.toUpperCase()} {event.strike}
                {spxPrice > 0 && event.symbol === 'SPX' ? ` (${Math.abs(event.strike - spxPrice).toFixed(1)} pts)` : ''}
              </p>
              <p className="text-[10px] text-white/55">Score {(event.score / 1000).toFixed(1)}k</p>
            </div>
            <div className="text-right">
              <p className="font-mono">{formatPremium(event.premium)}</p>
              <p className="text-[10px] text-white/55">{relativeAge(event.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
