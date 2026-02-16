'use client'

import type { GEXProfile } from '@/lib/types/spx-command-center'
import { InfoTip } from '@/components/ui/info-tip'

function formatGex(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return value.toFixed(0)
}

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

  const merged = [
    ...spx.keyLevels.map((level) => ({ ...level, source: 'SPX' as const })),
    ...spy.keyLevels.map((level) => ({ ...level, source: 'SPY' as const })),
  ]
    .sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))
    .slice(0, 10)

  const support = merged.filter((level) => level.gex >= 0).slice(0, 4)
  const pressure = merged.filter((level) => level.gex < 0).slice(0, 4)
  const maxAbs = Math.max(...merged.map((level) => Math.abs(level.gex)), 1)
  const netTopBook = merged.reduce((sum, level) => sum + level.gex, 0)

  return (
    <section className="glass-card-heavy rounded-2xl p-3 md:p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">SPX + SPY Heatmap</h3>
        <InfoTip label="How to use combined heatmap" panelClassName="w-64">
          Positive gamma levels can stabilize price; negative gamma can accelerate moves. Focus on the largest bars nearest spot.
        </InfoTip>
      </div>

      <div className="mt-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] text-white/75">
        Net posture: <span className={netTopBook >= 0 ? 'text-emerald-200' : 'text-rose-200'}>{netTopBook >= 0 ? 'Supportive' : 'Unstable'}</span>
        <span className="ml-1 font-mono text-white/60">({formatGex(netTopBook)})</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-200/80">Support levels</p>
          {support.length === 0 && <p className="text-xs text-white/55">No positive gamma levels.</p>}
          {support.map((level) => {
            const intensity = Math.min(1, Math.abs(level.gex) / maxAbs)
            return (
              <div key={`${level.source}-${level.strike}-${level.type}`} className="rounded-lg border border-emerald-400/25 bg-emerald-500/[0.08] p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-ivory">{level.strike.toFixed(2)}</p>
                  <p className="text-[10px] text-white/60">{level.source} {level.type.replace('_', ' ')}</p>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-emerald-400/80" style={{ width: `${Math.max(8, intensity * 100)}%` }} />
                </div>
                <p className="mt-1 font-mono text-emerald-100">{formatGex(level.gex)}</p>
              </div>
            )
          })}
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-rose-200/80">Pressure levels</p>
          {pressure.length === 0 && <p className="text-xs text-white/55">No negative gamma levels.</p>}
          {pressure.map((level) => {
            const intensity = Math.min(1, Math.abs(level.gex) / maxAbs)
            return (
              <div key={`${level.source}-${level.strike}-${level.type}`} className="rounded-lg border border-rose-400/25 bg-rose-500/[0.08] p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-ivory">{level.strike.toFixed(2)}</p>
                  <p className="text-[10px] text-white/60">{level.source} {level.type.replace('_', ' ')}</p>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-rose-300/80" style={{ width: `${Math.max(8, intensity * 100)}%` }} />
                </div>
                <p className="mt-1 font-mono text-rose-100">{formatGex(level.gex)}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
