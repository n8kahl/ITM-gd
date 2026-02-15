'use client'

import { Activity, Dot, Target } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { cn } from '@/lib/utils'

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

export function SPXHeader() {
  const { spxPrice, spyPrice, basis, regime } = useSPXCommandCenter()

  const basisColor = basis?.current && basis.current >= 0 ? 'text-emerald-300' : 'text-rose-300'

  return (
    <header className="glass-card-heavy rounded-2xl px-4 py-3 md:px-5 md:py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-300" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">SPX Command Center</p>
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">LIVE</span>
          </div>
          <h1 className="text-xl md:text-2xl font-serif text-ivory mt-1">Institutional Setup Intelligence</h1>
        </div>

        <div className="grid grid-cols-2 md:flex gap-2 md:gap-3 text-sm">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">SPX</p>
            <p className="font-mono text-lg text-ivory">{spxPrice ? spxPrice.toLocaleString() : '--'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">SPY</p>
            <p className="font-mono text-lg text-ivory">{spyPrice ? spyPrice.toLocaleString() : '--'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">Basis</p>
            <p className={cn('font-mono text-lg', basisColor)}>{basis ? formatSigned(basis.current) : '--'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">Regime</p>
            <p className="font-mono text-lg text-champagne capitalize">{regime || '--'}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-white/65">
        <Activity className="h-3.5 w-3.5 text-emerald-300" />
        <span>Real-time level matrix, setup lifecycle, and AI guidance</span>
        <Dot className="h-4 w-4 text-emerald-300" />
        <span>Pro Tier</span>
      </div>
    </header>
  )
}
