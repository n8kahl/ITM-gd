'use client'

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { buildGammaTopographyEntries, buildGammaVacuumZones } from '@/lib/spx/spatial-hud'

interface GammaTopographyOverlayProps {
  coordinatesRef: RefObject<ChartCoordinateAPI>
}

interface GammaBandRender {
  id: string
  top: number
  height: number
  widthPct: number
  color: string
  opacity: number
  edgeOpacity: number
}

interface GammaRenderState {
  bands: GammaBandRender[]
  vacuumZones: Array<{
    id: string
    top: number
    height: number
    opacity: number
  }>
}

const GAMMA_REFRESH_INTERVAL_MS = 160

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function renderStateEquals(left: GammaRenderState | null, right: GammaRenderState | null): boolean {
  if (!left || !right) return left === right
  if (left.bands.length !== right.bands.length) return false
  if (left.vacuumZones.length !== right.vacuumZones.length) return false
  for (let index = 0; index < left.bands.length; index += 1) {
    const l = left.bands[index]
    const r = right.bands[index]
    if (!l || !r) return false
    if (
      l.id !== r.id
      || l.top !== r.top
      || l.height !== r.height
      || l.widthPct !== r.widthPct
      || l.color !== r.color
      || l.opacity !== r.opacity
      || l.edgeOpacity !== r.edgeOpacity
    ) {
      return false
    }
  }
  for (let index = 0; index < left.vacuumZones.length; index += 1) {
    const l = left.vacuumZones[index]
    const r = right.vacuumZones[index]
    if (!l || !r) return false
    if (l.id !== r.id || l.top !== r.top || l.height !== r.height || l.opacity !== r.opacity) {
      return false
    }
  }
  return true
}

export function GammaTopographyOverlay({ coordinatesRef }: GammaTopographyOverlayProps) {
  const { gexProfile } = useSPXAnalyticsContext()
  const { spxPrice } = useSPXPriceContext()
  const [renderState, setRenderState] = useState<GammaRenderState | null>(null)

  const gammaEntries = useMemo(() => buildGammaTopographyEntries(
    gexProfile?.combined?.gexByStrike || [],
    spxPrice,
    { maxEntries: 12, minMagnitudeRatio: 0.14 },
  ), [gexProfile?.combined?.gexByStrike, spxPrice])
  const gammaVacuumZones = useMemo(() => buildGammaVacuumZones(
    gexProfile?.combined?.gexByStrike || [],
    spxPrice,
    { maxZones: 4, lowMagnitudeRatio: 0.14 },
  ), [gexProfile?.combined?.gexByStrike, spxPrice])

  const refreshRenderState = useCallback(() => {
    const coordinates = coordinatesRef.current
    if (!coordinates?.ready || (gammaEntries.length === 0 && gammaVacuumZones.length === 0)) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const height = coordinates.chartDimensions.height
    if (height <= 0) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const bands: GammaBandRender[] = []
    for (const entry of gammaEntries) {
      const y = coordinates.priceToPixel(entry.strike)
      if (y == null || y < 0 || y > height) continue
      const stripeHeight = clamp(9 + (entry.weight * 26), 10, 36)
      const top = clamp(y - (stripeHeight / 2), 0, Math.max(0, height - stripeHeight))
      const widthPct = clamp(28 + (entry.weight * 54), 28, 84)
      const opacity = clamp(0.16 + (entry.weight * 0.34), 0.16, 0.5)
      const edgeOpacity = clamp(0.45 + (entry.weight * 0.4), 0.45, 0.88)
      bands.push({
        id: `${entry.strike}:${entry.gex}`,
        top,
        height: stripeHeight,
        widthPct,
        color: entry.polarity === 'positive' ? '16,185,129' : '251,113,133',
        opacity,
        edgeOpacity,
      })
    }

    const vacuumZones = gammaVacuumZones.reduce<Array<{ id: string; top: number; height: number; opacity: number }>>((acc, zone, index) => {
      const yHigh = coordinates.priceToPixel(zone.high)
      const yLow = coordinates.priceToPixel(zone.low)
      if (yHigh == null || yLow == null) return acc
      const top = clamp(Math.min(yHigh, yLow), 0, height)
      const rawHeight = Math.abs(yLow - yHigh)
      const zoneHeight = clamp(rawHeight, 10, height)
      acc.push({
        id: `vacuum:${zone.low}:${zone.high}:${index}`,
        top,
        height: zoneHeight,
        opacity: clamp(0.16 + (zone.intensity * 0.2), 0.16, 0.34),
      })
      return acc
    }, [])

    const nextState: GammaRenderState = { bands, vacuumZones }
    setRenderState((previous) => (renderStateEquals(previous, nextState) ? previous : nextState))
  }, [coordinatesRef, gammaEntries, gammaVacuumZones])

  useEffect(() => {
    let rafId = 0
    const tick = () => {
      rafId = window.requestAnimationFrame(refreshRenderState)
    }

    tick()
    const intervalId = window.setInterval(tick, GAMMA_REFRESH_INTERVAL_MS)
    return () => {
      window.clearInterval(intervalId)
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [refreshRenderState])

  if (!renderState || (renderState.bands.length === 0 && renderState.vacuumZones.length === 0)) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[8]" data-testid="spx-gamma-topography" aria-hidden>
      <div
        className="absolute inset-y-0 right-0 w-[38%] border-l border-white/8"
        style={{
          background: 'linear-gradient(270deg, rgba(8,10,13,0.48) 0%, rgba(8,10,13,0.2) 45%, rgba(8,10,13,0) 100%)',
        }}
        data-testid="spx-gamma-rail"
      />
      {renderState.vacuumZones.map((zone) => (
        <div
          key={zone.id}
          className="absolute inset-x-0 border-y border-black/35"
          style={{
            top: zone.top,
            height: zone.height,
            background: `linear-gradient(90deg, transparent 0%, rgba(4, 8, 14, ${zone.opacity}) 28%, rgba(3, 5, 10, ${zone.opacity + 0.06}) 52%, rgba(4, 8, 14, ${zone.opacity}) 74%, transparent 100%)`,
          }}
          data-testid="spx-gamma-vacuum-zone"
        />
      ))}
      {renderState.bands.map((band) => (
        <div
          key={band.id}
          className="absolute right-0 overflow-hidden rounded-l-md border-y border-white/8"
          style={{
            top: band.top,
            height: band.height,
            width: `${band.widthPct}%`,
            background: `linear-gradient(270deg, rgba(${band.color}, ${band.opacity}) 0%, rgba(${band.color}, ${band.opacity * 0.58}) 38%, rgba(${band.color}, 0) 100%)`,
            boxShadow: `inset 0 0 0 1px rgba(${band.color}, 0.08)`,
          }}
        />
      ))}
      {renderState.bands.map((band) => (
        <div
          key={`${band.id}:edge`}
          className="absolute right-0 w-[2px]"
          style={{
            top: band.top,
            height: band.height,
            background: `rgba(${band.color}, ${band.edgeOpacity})`,
            boxShadow: `0 0 10px rgba(${band.color}, ${band.edgeOpacity * 0.7})`,
          }}
        />
      ))}
    </div>
  )
}
