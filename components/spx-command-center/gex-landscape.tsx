'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { GEXProfile } from '@/lib/types/spx-command-center'
import { cn } from '@/lib/utils'

const GEX_WINDOW_POINTS = 220
const GEX_MIN_LEVELS = 8
const GEX_MAX_LEVELS = 24

type GEXRow = {
  strike: unknown
  gex?: unknown
  gexValue?: unknown
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null

  const normalized = value.replace(/,/g, '').trim()
  if (!normalized) return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeGexRows(rows: GEXRow[]): Array<{ strike: number; gex: number }> {
  const byStrike = new Map<number, number>()

  for (const row of rows) {
    const strike = toFiniteNumber(row?.strike)
    const gex = toFiniteNumber(row?.gex ?? row?.gexValue)
    if (strike == null || gex == null) continue

    const roundedStrike = Math.round(strike * 10) / 10
    byStrike.set(roundedStrike, (byStrike.get(roundedStrike) ?? 0) + gex)
  }

  return Array.from(byStrike.entries())
    .map(([strike, gex]) => ({ strike, gex }))
    .sort((a, b) => a.strike - b.strike)
}

function pickReferencePrice(profile: GEXProfile): number {
  const spot = toFiniteNumber((profile as { spotPrice?: unknown }).spotPrice)
  if (spot != null && spot > 0) return spot

  const flip = toFiniteNumber(profile.flipPoint)
  if (flip != null && flip > 0) return flip

  const callWall = toFiniteNumber(profile.callWall)
  const putWall = toFiniteNumber(profile.putWall)
  if (callWall != null && putWall != null) return (callWall + putWall) / 2

  return 0
}

function quantileScale(values: number[], percentile: number): number {
  if (values.length === 0) return 1
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * percentile)),
  )
  return Math.max(sorted[index] || 1, 1)
}

export function GEXLandscape({ profile }: { profile: GEXProfile | null }) {
  const [expanded, setExpanded] = useState(false)

  if (!profile) return null

  const strikeLevels = normalizeGexRows((profile.gexByStrike ?? []) as GEXRow[])
  const keyLevels = normalizeGexRows((profile.keyLevels ?? []) as GEXRow[])
  const sourceLevels = strikeLevels.length >= 6 ? strikeLevels : keyLevels
  const referencePrice = pickReferencePrice(profile)

  const nearbyLevels = referencePrice > 0
    ? sourceLevels.filter((level) => Math.abs(level.strike - referencePrice) <= GEX_WINDOW_POINTS)
    : sourceLevels

  const candidatePool = nearbyLevels.length >= GEX_MIN_LEVELS ? nearbyLevels : sourceLevels
  const ranked = referencePrice > 0
    ? [...candidatePool].sort((a, b) => Math.abs(a.strike - referencePrice) - Math.abs(b.strike - referencePrice))
    : [...candidatePool].sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))

  const levels = ranked
    .slice(0, GEX_MAX_LEVELS)
    .sort((a, b) => a.strike - b.strike)

  const hasDistribution = levels.some((level) => Number.isFinite(level.gex) && Math.abs(level.gex) > 0)
  const absoluteValues = levels
    .map((level) => Math.abs(level.gex))
    .filter((value) => Number.isFinite(value) && value > 0)
  const scaleBase = quantileScale(absoluteValues, 0.85)

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
          {!hasDistribution ? (
            <p className="mt-2 text-[9px] font-mono text-white/35">
              Strike distribution unavailable for the current snapshot.
            </p>
          ) : (
            <>
              <div className="mt-2 h-24 flex items-end gap-[2px]">
                {levels.map((level) => {
                  const pct = Math.min(1, Math.abs(level.gex) / scaleBase)
                  const height = Math.max(12, pct * 100)
                  return (
                    <div
                      key={`${level.strike}-${level.gex}`}
                      className="flex h-full min-w-[3px] flex-1 items-end"
                      title={`${level.strike.toFixed(0)}: ${(level.gex / 1e6).toFixed(1)}M`}
                    >
                      <div
                        className={cn(
                          'w-full rounded-t',
                          level.gex >= 0 ? 'bg-emerald-400/65' : 'bg-rose-400/65',
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
            </>
          )}
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
