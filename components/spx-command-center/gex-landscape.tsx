'use client'

import type { GEXProfile } from '@/lib/types/spx-command-center'

export function GEXLandscape({ profile }: { profile: GEXProfile | null }) {
  if (!profile) {
    return <p className="text-xs text-white/55">GEX profile unavailable.</p>
  }

  const levels = [...profile.gexByStrike].sort((a, b) => a.strike - b.strike).slice(-40)
  const maxAbs = Math.max(...levels.map((item) => Math.abs(item.gex)), 1)

  return (
    <section className="glass-card-heavy rounded-2xl p-3 md:p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">GEX Landscape</h3>
        <p className="text-[11px] text-white/55">Flip {profile.flipPoint.toFixed(2)}</p>
      </div>

      <div className="mt-3 h-28 grid grid-cols-10 gap-1 items-end">
        {levels.slice(-30).map((level) => {
          const height = Math.max(6, (Math.abs(level.gex) / maxAbs) * 100)
          return (
            <div key={`${level.strike}-${level.gex}`} className="flex flex-col items-center justify-end gap-1">
              <div
                className={level.gex >= 0 ? 'w-full rounded bg-emerald-400/65' : 'w-full rounded bg-rose-400/60'}
                style={{ height: `${height}%` }}
                title={`${level.strike.toFixed(2)}: ${level.gex.toFixed(0)}`}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-white/70">
        <span>Call wall {profile.callWall.toFixed(2)}</span>
        <span>Put wall {profile.putWall.toFixed(2)}</span>
        <span>Net {profile.netGex.toLocaleString()}</span>
      </div>
    </section>
  )
}
