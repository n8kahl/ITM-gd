'use client'

import type { GEXProfile } from '@/lib/types/spx-command-center'
import { InfoTip } from '@/components/ui/info-tip'

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

  const rows = [...spx.keyLevels.slice(0, 4), ...spy.keyLevels.slice(0, 4)]
  const maxAbs = Math.max(...rows.map((level) => Math.abs(level.gex)), 1)

  return (
    <section className="glass-card-heavy rounded-2xl p-3 md:p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">SPX + SPY Heatmap</h3>
        <InfoTip label="How to use combined heatmap" panelClassName="w-64">
          Green zones are positive gamma support. Rose zones are negative gamma pressure. Use as context for where price may stall or accelerate.
        </InfoTip>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {rows.map((level, idx) => {
          const intensity = Math.min(1, Math.abs(level.gex) / maxAbs)
          const isPositive = level.gex >= 0
          return (
            <div
              key={`${level.strike}-${idx}`}
              className="rounded-lg border border-white/10 px-2 py-1.5 text-xs"
              style={{
                background: isPositive
                  ? `rgba(16,185,129,${0.1 + intensity * 0.25})`
                  : `rgba(251,113,133,${0.1 + intensity * 0.25})`,
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
