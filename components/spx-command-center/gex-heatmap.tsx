'use client'

import type { GEXProfile } from '@/lib/types/spx-command-center'

export function GEXHeatmap({
  spx,
  spy,
}: {
  spx: GEXProfile | null
  spy: GEXProfile | null
}) {
  if (!spx || !spy) {
    return <p className="text-xs text-white/55">Combined heatmap unavailable.</p>
  }

  const rows = [...spx.keyLevels.slice(0, 6), ...spy.keyLevels.slice(0, 6)]

  return (
    <section className="glass-card-heavy rounded-2xl p-3 md:p-4">
      <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">SPX + SPY Heatmap</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {rows.map((level, idx) => {
          const intensity = Math.min(1, Math.abs(level.gex) / Math.max(Math.abs(spx.netGex), 1))
          return (
            <div
              key={`${level.strike}-${idx}`}
              className="rounded-lg border border-white/10 px-2 py-1.5 text-xs"
              style={{
                background: `rgba(16,185,129,${0.1 + intensity * 0.25})`,
              }}
            >
              <p className="font-mono text-ivory">{level.strike.toFixed(2)}</p>
              <p className="text-white/70">{level.gex.toFixed(0)}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
