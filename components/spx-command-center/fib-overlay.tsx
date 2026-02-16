'use client'

import { useState } from 'react'
import type { FibLevel } from '@/lib/types/spx-command-center'
import { InfoTip } from '@/components/ui/info-tip'

export function FibOverlay({ levels }: { levels: FibLevel[] }) {
  const [showAll, setShowAll] = useState(false)

  if (levels.length === 0) {
    return <p className="text-xs text-white/55">No fibonacci overlays loaded.</p>
  }

  const visibleLevels = (showAll ? levels : levels.slice(0, 6)).slice(0, 12)

  return (
    <section className="glass-card-heavy rounded-2xl p-3 md:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">Fibonacci Overlay</h3>
          <InfoTip label="How to use Fibonacci overlay">
            Use these as reaction zones, not exact entries. Confirm with regime and flow before acting.
          </InfoTip>
        </div>
        <button
          type="button"
          onClick={() => setShowAll((prev) => !prev)}
          className="rounded-md border border-white/20 bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white/60"
        >
          {showAll ? 'Less' : 'More'}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {visibleLevels.map((level, idx) => (
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
