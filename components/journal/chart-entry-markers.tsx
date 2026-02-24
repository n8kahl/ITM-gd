'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

/**
 * Chart Entry Markers
 *
 * Renders journal trade entry/exit markers as an overlay layer on top of a price chart.
 * Designed to be positioned absolutely within a chart container.
 *
 * Each marker shows:
 *   - Entry arrow (up for long, down for short)
 *   - P&L badge on hover
 *   - Color coded (emerald for winners, red for losers)
 *
 * Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md — Phase 4, Slice 4E
 */

interface ChartMarker {
  id: string
  type: 'entry' | 'exit'
  timestamp: string
  price: number
  direction: 'long' | 'short'
  pnl: number | null
  symbol: string
}

interface ChartEntryMarkersProps {
  symbol: string
  /** Chart time range start (ISO) */
  timeStart: string
  /** Chart time range end (ISO) */
  timeEnd: string
  /** Chart price range */
  priceHigh: number
  priceLow: number
  /** Container dimensions */
  width: number
  height: number
}

function toTimestamp(iso: string): number {
  return new Date(iso).getTime()
}

export function ChartEntryMarkers({
  symbol,
  timeStart,
  timeEnd,
  priceHigh,
  priceLow,
  width,
  height,
}: ChartEntryMarkersProps) {
  const [markers, setMarkers] = useState<ChartMarker[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const loadMarkers = useCallback(async () => {
    if (!symbol || width <= 0 || height <= 0) return

    try {
      const params = new URLSearchParams({
        symbol,
        sortBy: 'trade_date',
        sortDir: 'asc',
        limit: '100',
        offset: '0',
      })

      const response = await fetch(`/api/members/journal?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) return

      const payload = await response.json()
      if (!payload.success || !Array.isArray(payload.data)) return

      const chartMarkers: ChartMarker[] = []
      const startTs = toTimestamp(timeStart)
      const endTs = toTimestamp(timeEnd)

      for (const entry of payload.data as Array<Record<string, unknown>>) {
        const entryTs = entry.entry_timestamp ? toTimestamp(entry.entry_timestamp as string) : null
        const exitTs = entry.exit_timestamp ? toTimestamp(entry.exit_timestamp as string) : null
        const entryPrice = typeof entry.entry_price === 'number' ? entry.entry_price : null
        const exitPrice = typeof entry.exit_price === 'number' ? entry.exit_price : null

        if (entryTs && entryTs >= startTs && entryTs <= endTs && entryPrice) {
          chartMarkers.push({
            id: `${entry.id}-entry`,
            type: 'entry',
            timestamp: entry.entry_timestamp as string,
            price: entryPrice,
            direction: entry.direction as 'long' | 'short',
            pnl: typeof entry.pnl === 'number' ? entry.pnl : null,
            symbol: entry.symbol as string,
          })
        }

        if (exitTs && exitTs >= startTs && exitTs <= endTs && exitPrice) {
          chartMarkers.push({
            id: `${entry.id}-exit`,
            type: 'exit',
            timestamp: entry.exit_timestamp as string,
            price: exitPrice,
            direction: entry.direction as 'long' | 'short',
            pnl: typeof entry.pnl === 'number' ? entry.pnl : null,
            symbol: entry.symbol as string,
          })
        }
      }

      setMarkers(chartMarkers)
    } catch {
      // Non-critical overlay — silently fail
    }
  }, [symbol, timeStart, timeEnd, width, height])

  useEffect(() => {
    const initialFetch = window.setTimeout(() => {
      void loadMarkers()
    }, 0)
    return () => window.clearTimeout(initialFetch)
  }, [loadMarkers])

  if (markers.length === 0 || width <= 0 || height <= 0) return null

  const startTs = toTimestamp(timeStart)
  const endTs = toTimestamp(timeEnd)
  const timeRange = endTs - startTs
  const priceRange = priceHigh - priceLow

  if (timeRange <= 0 || priceRange <= 0) return null

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {markers.map((marker: ChartMarker) => {
        const ts = toTimestamp(marker.timestamp)
        const xPct = ((ts - startTs) / timeRange) * 100
        const yPct = ((priceHigh - marker.price) / priceRange) * 100

        if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) return null

        const isWinner = marker.pnl != null && marker.pnl > 0
        const colorClass = marker.pnl != null
          ? isWinner ? 'text-emerald-400' : 'text-red-400'
          : 'text-white/50'

        return (
          <div
            key={marker.id}
            className="pointer-events-auto absolute"
            style={{
              left: `${xPct}%`,
              top: `${yPct}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onMouseEnter={() => setHoveredId(marker.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className={`flex h-5 w-5 items-center justify-center rounded-full border border-current bg-black/80 ${colorClass}`}>
              {marker.type === 'entry' ? (
                marker.direction === 'long' ? (
                  <ArrowUp className="h-3 w-3" strokeWidth={2} />
                ) : (
                  <ArrowDown className="h-3 w-3" strokeWidth={2} />
                )
              ) : (
                <span className="text-[9px] font-bold">X</span>
              )}
            </div>

            {hoveredId === marker.id && marker.pnl != null && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-white/10 bg-black/90 px-1.5 py-0.5 text-[10px] font-mono">
                <span className={isWinner ? 'text-emerald-400' : 'text-red-400'}>
                  {marker.pnl >= 0 ? '+' : ''}${marker.pnl.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
