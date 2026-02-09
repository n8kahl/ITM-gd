'use client'

import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MorningBrief } from '@/lib/api/ai-coach'

function toBarWidthPercent(atrRatio: number | null, gapPct: number): number {
  if (atrRatio != null && Number.isFinite(atrRatio)) {
    return Math.min(100, Math.max(8, Math.abs(atrRatio) * 55))
  }
  return Math.min(100, Math.max(8, Math.abs(gapPct) * 18))
}

export function OvernightGapCard({
  overnightSummary,
}: {
  overnightSummary: NonNullable<MorningBrief['overnightSummary']>
}) {
  const directionTone = overnightSummary.futuresDirection === 'up'
    ? 'text-emerald-300'
    : overnightSummary.futuresDirection === 'down'
      ? 'text-red-300'
      : 'text-white/60'

  return (
    <section className="glass-card-heavy rounded-xl p-4 border border-white/10">
      <p className="text-[10px] text-white/35 uppercase tracking-wide mb-3">Overnight Gap</p>

      <div className={cn('flex items-center gap-2 text-sm font-medium mb-3', directionTone)}>
        {overnightSummary.futuresDirection === 'up' ? (
          <TrendingUp className="w-4 h-4" />
        ) : overnightSummary.futuresDirection === 'down' ? (
          <TrendingDown className="w-4 h-4" />
        ) : (
          <Minus className="w-4 h-4" />
        )}
        <span>Futures {overnightSummary.futuresDirection}</span>
        <span className="font-mono">
          {overnightSummary.futuresChange >= 0 ? '+' : ''}{overnightSummary.futuresChange.toFixed(2)}
          ({overnightSummary.futuresChangePct >= 0 ? '+' : ''}{overnightSummary.futuresChangePct.toFixed(2)}%)
        </span>
      </div>

      {(overnightSummary.gapAnalysis || []).length > 0 ? (
        <div className="space-y-2">
          {overnightSummary.gapAnalysis.map((gap) => {
            const isUp = gap.gapType === 'up'
            const barTone = isUp ? 'bg-emerald-500/70' : gap.gapType === 'down' ? 'bg-red-500/70' : 'bg-white/30'
            const textTone = isUp ? 'text-emerald-300' : gap.gapType === 'down' ? 'text-red-300' : 'text-white/60'
            const barWidth = toBarWidthPercent(gap.atrRatio, gap.gapPct)

            return (
              <div key={gap.symbol} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-white/80 font-medium">{gap.symbol}</span>
                  <span className={cn('font-mono', textTone)}>
                    {gap.gapPct >= 0 ? '+' : ''}{gap.gapPct.toFixed(2)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className={cn('h-full rounded-full', barTone)} style={{ width: `${barWidth}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/40">
                  <span>
                    {gap.atrRatio != null ? `${gap.atrRatio.toFixed(1)}x ATR` : 'ATR ratio n/a'}
                  </span>
                  <span>
                    {gap.historicalFillRate != null ? `${(gap.historicalFillRate * 100).toFixed(0)}% fill rate` : 'fill-rate n/a'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-white/45">No overnight gap data available.</p>
      )}
    </section>
  )
}
