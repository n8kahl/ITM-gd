'use client'

import { useMemo, useState } from 'react'
import type { ChartBar, EnrichedTrade } from '@/lib/trade-day-replay/types'

type MarkerKind = 'entry' | 'full_exit' | 'trim'

interface RawMarker {
  id: string
  kind: MarkerKind
  timeSec: number
  price: number
  contractLabel: string
  pnlPercent: number | null
}

interface OverlayMarker {
  id: string
  kind: MarkerKind
  xPct: number
  yPct: number
  symbol: string
  contractLabel: string
  pnlPercent: number | null
}

interface OverlayStopLine {
  id: string
  yPct: number
  price: number
}

interface TradeMarkerOverlayProps {
  visibleBars: ChartBar[]
  trades: EnrichedTrade[]
}

function parseEpochSeconds(value: string | null | undefined): number | null {
  if (!value) return null
  const epochMs = Date.parse(value)
  if (!Number.isFinite(epochMs)) return null
  return Math.floor(epochMs / 1000)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function findNearestBarIndex(bars: ChartBar[], targetTimeSec: number): number | null {
  if (!bars.length) return null

  let left = 0
  let right = bars.length - 1

  while (left < right) {
    const mid = Math.floor((left + right) / 2)
    if (bars[mid]!.time < targetTimeSec) {
      left = mid + 1
    } else {
      right = mid
    }
  }

  const candidate = left
  const previous = Math.max(candidate - 1, 0)
  const candidateDistance = Math.abs(bars[candidate]!.time - targetTimeSec)
  const previousDistance = Math.abs(bars[previous]!.time - targetTimeSec)
  return previousDistance <= candidateDistance ? previous : candidate
}

function formatContractLabel(trade: EnrichedTrade): string {
  const strike = isFiniteNumber(trade.contract?.strike)
    ? Number.isInteger(trade.contract.strike) ? String(trade.contract.strike) : trade.contract.strike.toFixed(1)
    : '?'
  const type = trade.contract?.type === 'put' ? 'Put' : 'Call'
  return `SPX ${strike} ${type}`
}

function markerSymbol(kind: MarkerKind): string {
  if (kind === 'entry') return '▲'
  if (kind === 'full_exit') return '▼'
  return '◆'
}

function markerClassName(kind: MarkerKind): string {
  if (kind === 'entry') return 'text-emerald-400'
  if (kind === 'full_exit') return 'text-red-400'
  return 'text-[rgba(232,212,170,0.95)]'
}

function formatPnlLabel(pnlPercent: number | null): string | null {
  if (!isFiniteNumber(pnlPercent)) return null
  return `${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`
}

export function TradeMarkerOverlay({ visibleBars, trades }: TradeMarkerOverlayProps) {
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null)

  const { markers, stopLines } = useMemo(() => {
    if (visibleBars.length === 0 || trades.length === 0) {
      return { markers: [] as OverlayMarker[], stopLines: [] as OverlayStopLine[] }
    }

    const firstVisibleTime = visibleBars[0]!.time
    const lastVisibleTime = visibleBars[visibleBars.length - 1]!.time
    const isInWindow = (timeSec: number) => timeSec >= firstVisibleTime && timeSec <= lastVisibleTime

    const rawMarkers: RawMarker[] = []
    const rawStopLevels: Array<{ id: string; price: number }> = []

    for (const trade of trades) {
      const contractLabel = formatContractLabel(trade)
      const pnlPercent = isFiniteNumber(trade.pnlPercent) ? trade.pnlPercent : null

      const entryTimeSec = parseEpochSeconds(trade.entryTimestamp)
      if (entryTimeSec != null && isInWindow(entryTimeSec)) {
        const nearestIndex = findNearestBarIndex(visibleBars, entryTimeSec)
        if (nearestIndex != null) {
          const nearestBar = visibleBars[nearestIndex]!
          const referencePrice = trade.spxReferences.find(isFiniteNumber) ?? nearestBar.close
          rawMarkers.push({
            id: `entry-${trade.tradeIndex}`,
            kind: 'entry',
            timeSec: nearestBar.time,
            price: referencePrice,
            contractLabel,
            pnlPercent,
          })
        }
      }

      const exitEvents = Array.isArray(trade.exitEvents) ? trade.exitEvents : []
      for (const exitEvent of exitEvents) {
        if (exitEvent.type !== 'full_exit' && exitEvent.type !== 'trim') continue

        const eventTimeSec = parseEpochSeconds(exitEvent.timestamp)
        if (eventTimeSec == null || !isInWindow(eventTimeSec)) continue

        const nearestIndex = findNearestBarIndex(visibleBars, eventTimeSec)
        if (nearestIndex == null) continue

        const nearestBar = visibleBars[nearestIndex]!
        rawMarkers.push({
          id: `${exitEvent.type}-${trade.tradeIndex}-${eventTimeSec}-${nearestBar.time}`,
          kind: exitEvent.type,
          timeSec: nearestBar.time,
          price: exitEvent.type === 'full_exit' ? nearestBar.high : nearestBar.close,
          contractLabel,
          pnlPercent,
        })
      }

      const stopLevels = Array.isArray(trade.stopLevels) ? trade.stopLevels : []
      for (const stopLevel of stopLevels) {
        const stopTimeSec = parseEpochSeconds(stopLevel.timestamp)
        if (!isFiniteNumber(stopLevel.spxLevel) || stopTimeSec == null || !isInWindow(stopTimeSec)) continue

        rawStopLevels.push({
          id: `stop-${trade.tradeIndex}-${stopTimeSec}-${stopLevel.spxLevel.toFixed(2)}`,
          price: stopLevel.spxLevel,
        })
      }
    }

    if (rawMarkers.length === 0 && rawStopLevels.length === 0) {
      return { markers: [] as OverlayMarker[], stopLines: [] as OverlayStopLine[] }
    }

    const barLows = visibleBars.map((bar) => bar.low).filter(isFiniteNumber)
    const barHighs = visibleBars.map((bar) => bar.high).filter(isFiniteNumber)
    const overlayPrices = [
      ...rawMarkers.map((marker) => marker.price).filter(isFiniteNumber),
      ...rawStopLevels.map((stop) => stop.price).filter(isFiniteNumber),
    ]
    const minBarPrice = barLows.length > 0 ? Math.min(...barLows) : 0
    const maxBarPrice = barHighs.length > 0 ? Math.max(...barHighs) : 0
    const minPrice = Math.min(minBarPrice, ...(overlayPrices.length > 0 ? overlayPrices : [minBarPrice]))
    const maxPrice = Math.max(maxBarPrice, ...(overlayPrices.length > 0 ? overlayPrices : [maxBarPrice]))
    const paddedRange = Math.max(maxPrice - minPrice, 1)
    const padding = Math.max(paddedRange * 0.08, 0.5)
    const rangeMin = minPrice - padding
    const rangeMax = maxPrice + padding
    const priceRange = Math.max(rangeMax - rangeMin, 1)

    const toXPct = (timeSec: number): number => {
      const index = findNearestBarIndex(visibleBars, timeSec)
      if (index == null) return 0
      if (visibleBars.length <= 1) return 50
      return (index / (visibleBars.length - 1)) * 100
    }

    const toYPct = (price: number): number => {
      const raw = ((rangeMax - price) / priceRange) * 100
      return Math.min(Math.max(raw, 0), 100)
    }

    const markers = rawMarkers
      .map<OverlayMarker>((marker) => ({
        id: marker.id,
        kind: marker.kind,
        xPct: toXPct(marker.timeSec),
        yPct: toYPct(marker.price),
        symbol: markerSymbol(marker.kind),
        contractLabel: marker.contractLabel,
        pnlPercent: marker.pnlPercent,
      }))
      .sort((left, right) => left.xPct - right.xPct)

    const dedupedStopLevels = Array.from(new Map(rawStopLevels.map((stop) => [stop.id, stop])).values())
    const stopLines = dedupedStopLevels.map<OverlayStopLine>((stop) => ({
      id: stop.id,
      yPct: toYPct(stop.price),
      price: stop.price,
    }))

    return { markers, stopLines }
  }, [trades, visibleBars])

  const hoveredMarker = useMemo(
    () => markers.find((marker) => marker.id === hoveredMarkerId) ?? null,
    [markers, hoveredMarkerId],
  )

  if (visibleBars.length === 0 || (markers.length === 0 && stopLines.length === 0)) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      {stopLines.map((line) => (
        <div
          key={line.id}
          className="absolute left-0 right-0 border-t border-dashed border-red-400/70"
          style={{ top: `${line.yPct}%` }}
        >
          <span className="absolute left-1 top-0 -translate-y-[90%] rounded-sm bg-black/75 px-1 text-[9px] text-red-200">
            {line.price.toFixed(1)}
          </span>
        </div>
      ))}

      {markers.map((marker) => (
        <button
          key={marker.id}
          type="button"
          className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 text-sm font-bold ${markerClassName(marker.kind)}`}
          style={{
            left: `${marker.xPct}%`,
            top: `${marker.yPct}%`,
          }}
          onMouseEnter={() => setHoveredMarkerId(marker.id)}
          onMouseLeave={() => setHoveredMarkerId((current) => (current === marker.id ? null : current))}
        >
          {marker.symbol}
        </button>
      ))}

      {hoveredMarker ? (
        <div
          className="absolute rounded border border-white/10 bg-black/90 px-2 py-1 text-[10px] text-ivory shadow-lg"
          style={{
            left: `${hoveredMarker.xPct}%`,
            top: `${hoveredMarker.yPct}%`,
            transform: 'translate(-50%, -140%)',
          }}
        >
          <p className="font-medium">{hoveredMarker.contractLabel}</p>
          {formatPnlLabel(hoveredMarker.pnlPercent) ? (
            <p className={hoveredMarker.pnlPercent != null && hoveredMarker.pnlPercent >= 0 ? 'text-emerald-300' : 'text-red-300'}>
              {formatPnlLabel(hoveredMarker.pnlPercent)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
