'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { GEXProfile } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'

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
  const [expanded, setExpanded] = useState(false)

  if (!spx && !spy) return null

  const spxLevels = spx?.keyLevels ?? []
  const spyLevels = spy?.keyLevels ?? []
  if (spxLevels.length === 0 && spyLevels.length === 0) return null

  const merged = [
    ...spxLevels.map((level) => ({ ...level, source: 'SPX' as const })),
    ...spyLevels.map((level) => ({ ...level, source: 'SPY' as const })),
  ]
    .sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))
    .slice(0, 8)

  const support = merged.filter((level) => level.gex >= 0).slice(0, 3)
  const pressure = merged.filter((level) => level.gex < 0).slice(0, 3)
  const maxAbs = Math.max(...merged.map((level) => Math.abs(level.gex)), 1)
  const netTopBook = merged.reduce((sum, level) => sum + level.gex, 0)

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between"
      >
        <span className="text-[10px] uppercase tracking-[0.12em] text-white/45">SPX + SPY Heatmap</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-[9px] font-mono', netTopBook >= 0 ? 'text-emerald-300/60' : 'text-rose-300/60')}>
            {netTopBook >= 0 ? 'Supportive' : 'Unstable'} {formatGex(netTopBook)}
          </span>
          <ChevronDown className={cn('h-3 w-3 text-white/40 transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>

      {/* Compact: top support + pressure inline */}
      {!expanded && (
        <div className="mt-1.5 flex items-center gap-2 text-[9px] font-mono">
          {support[0] && (
            <span className="text-emerald-300/60">
              S {support[0].strike.toFixed(0)} ({support[0].source})
            </span>
          )}
          {pressure[0] && (
            <span className="text-rose-300/60">
              P {pressure[0].strike.toFixed(0)} ({pressure[0].source})
            </span>
          )}
          <span className="text-white/30">{merged.length} levels</span>
        </div>
      )}

      {/* Expanded: full key levels */}
      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-[0.1em] text-emerald-200/60">Support</p>
            {support.length === 0 && <p className="text-[9px] text-white/35">None</p>}
            {support.map((level) => {
              const intensity = Math.min(1, Math.abs(level.gex) / maxAbs)
              return (
                <div key={`${level.source}-${level.strike}-${level.type}`} className="flex items-center gap-1.5">
                  <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                    <div className="h-full rounded-full bg-emerald-400/60" style={{ width: `${Math.max(10, intensity * 100)}%` }} />
                  </div>
                  <span className="font-mono text-[9px] text-white/55 min-w-[42px] text-right">{level.strike.toFixed(0)}</span>
                  <span className="text-[7px] text-white/30">{level.source}</span>
                </div>
              )
            })}
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-[0.1em] text-rose-200/60">Pressure</p>
            {pressure.length === 0 && <p className="text-[9px] text-white/35">None</p>}
            {pressure.map((level) => {
              const intensity = Math.min(1, Math.abs(level.gex) / maxAbs)
              return (
                <div key={`${level.source}-${level.strike}-${level.type}`} className="flex items-center gap-1.5">
                  <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                    <div className="h-full rounded-full bg-rose-400/60" style={{ width: `${Math.max(10, intensity * 100)}%` }} />
                  </div>
                  <span className="font-mono text-[9px] text-white/55 min-w-[42px] text-right">{level.strike.toFixed(0)}</span>
                  <span className="text-[7px] text-white/30">{level.source}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
