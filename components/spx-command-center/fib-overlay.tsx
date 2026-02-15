'use client'

import type { FibLevel } from '@/lib/types/spx-command-center'

export function FibOverlay({ levels }: { levels: FibLevel[] }) {
  if (levels.length === 0) {
    return <p className="text-xs text-white/55">No fibonacci overlays loaded.</p>
  }

  return (
    <section className="glass-card-heavy rounded-2xl p-3 md:p-4">
      <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">Fibonacci Overlay</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {levels.slice(0, 10).map((level, idx) => (
          <div key={`${level.timeframe}-${level.ratio}-${idx}`} className="rounded-lg border border-champagne/20 bg-champagne/5 px-2 py-1.5">
            <p className="font-mono text-champagne">{(level.ratio * 100).toFixed(1)}%</p>
            <p className="text-ivory">{level.price.toFixed(2)}</p>
            <p className="text-white/60 uppercase text-[10px]">{level.timeframe}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
