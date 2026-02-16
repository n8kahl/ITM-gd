'use client'

import { cn } from '@/lib/utils'
import type { PredictionState, Regime } from '@/lib/types/spx-command-center'
import { InfoTip } from '@/components/ui/info-tip'

function regimeColor(regime: Regime | null): string {
  if (regime === 'breakout') return 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200'
  if (regime === 'trending') return 'bg-sky-500/20 border-sky-300/40 text-sky-200'
  if (regime === 'compression') return 'bg-amber-500/15 border-amber-300/35 text-amber-200'
  return 'bg-white/5 border-white/20 text-white/80'
}

export function RegimeBar({
  regime,
  direction,
  confidence,
  prediction,
}: {
  regime: Regime | null
  direction: 'bullish' | 'bearish' | 'neutral' | null
  confidence: number | null
  prediction: PredictionState | null
}) {
  return (
    <div className={cn('rounded-xl border px-3 py-2 text-sm', regimeColor(regime))}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.15em]">Regime</span>
        <InfoTip label="How to use regime signal">
          Regime tells you market behavior context. Favor trend setups in trending regimes and mean-reversion setups in ranging/compression regimes.
        </InfoTip>
        <span className="font-mono uppercase">{regime || '--'}</span>
        <span className="text-white/55">|</span>
        <span className="capitalize">{direction || '--'}</span>
        <span className="text-white/55">|</span>
        <span>Conf {confidence != null ? `${confidence.toFixed(0)}%` : '--'}</span>
      </div>
      {prediction && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-white/75">
          <span className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-1">↑ {prediction.direction.bullish.toFixed(0)}%</span>
          <span className="rounded-md border border-rose-400/20 bg-rose-500/10 px-1.5 py-1">↓ {prediction.direction.bearish.toFixed(0)}%</span>
          <span className="rounded-md border border-white/20 bg-white/[0.05] px-1.5 py-1">↔ {prediction.direction.neutral.toFixed(0)}%</span>
        </div>
      )}
    </div>
  )
}
