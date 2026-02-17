'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { GEXProfile } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'

export function GEXLandscape({ profile }: { profile: GEXProfile | null }) {
  const [expanded, setExpanded] = useState(false)

  if (!profile) return null

  // Check if data is meaningful
  const hasData = profile.gexByStrike.some((s) => s.gex !== 0)
  if (!hasData) return null

  const levels = [...profile.gexByStrike].sort((a, b) => a.strike - b.strike).slice(-20)
  const maxAbs = Math.max(...levels.map((item) => Math.abs(item.gex)), 1)

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between"
      >
        <span className="text-[10px] uppercase tracking-[0.12em] text-white/45">GEX Landscape</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-white/40">
            Flip {profile.flipPoint.toFixed(0)}
          </span>
          <ChevronDown className={cn('h-3 w-3 text-white/40 transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>

      {/* Compact: single-line summary */}
      {!expanded && (
        <div className="mt-1.5 flex items-center gap-3 text-[9px] font-mono text-white/50">
          <span>Call wall {profile.callWall.toFixed(0)}</span>
          <span>Put wall {profile.putWall.toFixed(0)}</span>
          <span className={profile.netGex >= 0 ? 'text-emerald-300/60' : 'text-rose-300/60'}>
            Net {profile.netGex >= 0 ? '+' : ''}{(profile.netGex / 1e6).toFixed(1)}M
          </span>
        </div>
      )}

      {/* Expanded: bar chart */}
      {expanded && (
        <>
          <div className="mt-2 h-20 flex items-end gap-[2px]">
            {levels.map((level) => {
              const height = Math.max(4, (Math.abs(level.gex) / maxAbs) * 100)
              return (
                <div
                  key={`${level.strike}-${level.gex}`}
                  className="flex-1 min-w-0"
                  title={`${level.strike.toFixed(0)}: ${(level.gex / 1e6).toFixed(1)}M`}
                >
                  <div
                    className={cn(
                      'w-full rounded-t',
                      level.gex >= 0 ? 'bg-emerald-400/50' : 'bg-rose-400/50',
                    )}
                    style={{ height: `${height}%` }}
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[8px] font-mono text-white/35">
            <span>{levels[0]?.strike.toFixed(0)}</span>
            <span>{levels[levels.length - 1]?.strike.toFixed(0)}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[9px] font-mono text-white/50">
            <span>Call wall {profile.callWall.toFixed(0)}</span>
            <span>Put wall {profile.putWall.toFixed(0)}</span>
            <span className={profile.netGex >= 0 ? 'text-emerald-300/60' : 'text-rose-300/60'}>
              Net {profile.netGex >= 0 ? '+' : ''}{(profile.netGex / 1e6).toFixed(1)}M
            </span>
          </div>
        </>
      )}
    </div>
  )
}
