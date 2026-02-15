'use client'

import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BasisState } from '@/lib/types/spx-command-center'

export function BasisIndicator({ basis }: { basis: BasisState | null }) {
  if (!basis) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/60">
        Basis data unavailable
      </div>
    )
  }

  const TrendIcon = basis.trend === 'expanding' ? ArrowUp : basis.trend === 'contracting' ? ArrowDown : Minus

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.15em] text-white/50">SPX/SPY Basis</p>
        <TrendIcon className={cn(
          'h-4 w-4',
          basis.trend === 'expanding' && 'text-emerald-300',
          basis.trend === 'contracting' && 'text-rose-300',
          basis.trend === 'stable' && 'text-white/55',
        )} />
      </div>
      <p className="mt-1 font-mono text-lg text-ivory">{basis.current.toFixed(2)}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-white/50">EMA5</p>
          <p className="font-mono text-ivory">{basis.ema5.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-white/50">EMA20</p>
          <p className="font-mono text-ivory">{basis.ema20.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-white/50">Z</p>
          <p className="font-mono text-ivory">{basis.zscore.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}
