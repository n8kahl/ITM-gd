'use client'

import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface GEXStrikeRow {
  strike: number
  gexValue: number
}

interface GEXChartProps {
  data: GEXStrikeRow[]
  spotPrice?: number
  flipPoint?: number | null
  maxGEXStrike?: number | null
  className?: string
  maxRows?: number
}

function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

function normalizeNumber(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function pickRowsAroundSpot(
  points: GEXStrikeRow[],
  spotPrice: number | undefined,
  maxRows: number,
): GEXStrikeRow[] {
  if (points.length <= maxRows) return points

  if (typeof spotPrice !== 'number' || !Number.isFinite(spotPrice)) {
    return points.slice(0, maxRows)
  }

  const sorted = [...points].sort((a, b) => a.strike - b.strike)
  let closestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY

  for (let i = 0; i < sorted.length; i += 1) {
    const distance = Math.abs(sorted[i].strike - spotPrice)
    if (distance < bestDistance) {
      bestDistance = distance
      closestIndex = i
    }
  }

  const half = Math.floor(maxRows / 2)
  let start = Math.max(0, closestIndex - half)
  let end = Math.min(sorted.length, start + maxRows)

  if (end - start < maxRows) {
    start = Math.max(0, end - maxRows)
  }

  return sorted.slice(start, end)
}

export function GEXChart({
  data,
  spotPrice,
  flipPoint,
  maxGEXStrike,
  className,
  maxRows = 16,
}: GEXChartProps) {
  const points = [...data]
    .filter((row) => Number.isFinite(row.strike) && Number.isFinite(row.gexValue))
    .sort((a, b) => a.strike - b.strike)

  if (points.length === 0) {
    return (
      <div className={cn('rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/40', className)}>
        No GEX data available.
      </div>
    )
  }

  const displayed = pickRowsAroundSpot(points, spotPrice, maxRows)
  const maxAbs = Math.max(...displayed.map((point) => Math.abs(point.gexValue)), 1)

  const normalizedFlip = normalizeNumber(flipPoint)
  const normalizedMax = normalizeNumber(maxGEXStrike)

  return (
    <div className={cn('rounded-lg border border-white/10 bg-black/20 p-3', className)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium text-white/90">Gamma Exposure (GEX)</h4>
          <p className="mt-0.5 text-[10px] text-white/50">Dealer hedging pressure by strike</p>
        </div>

        <details className="group relative">
          <summary className="cursor-pointer list-none rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white/80">
            <Info className="h-3.5 w-3.5" />
          </summary>
          <div className="absolute right-0 z-30 mt-1 w-72 rounded border border-white/15 bg-black/95 p-2 text-[10px] text-white/75 shadow-2xl">
            <p className="font-medium text-white/90">How to read GEX</p>
            <p className="mt-1">
              Positive GEX tends to dampen volatility; negative GEX can amplify directional moves.
            </p>
            <ul className="mt-1 space-y-0.5 text-white/65">
              <li><span className="text-yellow-300">Flip:</span> Transition point between positive and negative gamma.</li>
              <li><span className="text-violet-300">Max GEX:</span> Strike with strongest dealer hedge gravity.</li>
              <li><span className="text-emerald-300">Use:</span> Combine with key levels for confluence zones.</li>
            </ul>
          </div>
        </details>
      </div>

      <div className="mb-2 flex items-center justify-between text-[10px] text-white/50">
        <span>Negative GEX</span>
        <span>Positive GEX</span>
      </div>

      <div className="space-y-1.5">
        {displayed.map((point) => {
          const magnitudePct = Math.max(2, Math.round((Math.abs(point.gexValue) / maxAbs) * 50))
          const isPositive = point.gexValue >= 0
          const isFlip = normalizedFlip != null && point.strike === normalizedFlip
          const isMax = normalizedMax != null && point.strike === normalizedMax
          const isSpot = typeof spotPrice === 'number' && Math.round(point.strike) === Math.round(spotPrice)

          return (
            <div
              key={point.strike}
              className={cn(
                'grid grid-cols-[58px_1fr_66px] items-center gap-2 rounded px-1.5 py-1',
                isFlip && 'bg-yellow-500/10 ring-1 ring-yellow-500/30',
                isMax && 'bg-violet-500/10 ring-1 ring-violet-500/30',
                isSpot && 'bg-emerald-500/10 ring-1 ring-emerald-500/30',
              )}
            >
              <span className="font-mono text-[10px] text-white/65">{point.strike.toLocaleString()}</span>

              <div className="relative h-3 overflow-hidden rounded bg-white/5">
                <span className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
                <span
                  className={cn(
                    'absolute top-0 h-full rounded',
                    isPositive ? 'left-1/2 bg-emerald-500/80' : 'right-1/2 bg-red-500/80',
                  )}
                  style={{ width: `${magnitudePct}%` }}
                />
              </div>

              <span className={cn('text-right font-mono text-[10px]', isPositive ? 'text-emerald-300' : 'text-red-300')}>
                {formatCompact(point.gexValue)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-white/45">
        {normalizedFlip != null && <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-yellow-300">Flip</span>}
        {normalizedMax != null && <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-300">Max GEX</span>}
        {typeof spotPrice === 'number' && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">Spot</span>}
      </div>
    </div>
  )
}
