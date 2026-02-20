'use client'

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { buildGammaTopographyEntries } from '@/lib/spx/spatial-hud'

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
}

interface GammaRenderState {
  bands: GammaBandRender[]
}

const GAMMA_REFRESH_INTERVAL_MS = 160

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function renderStateEquals(left: GammaRenderState | null, right: GammaRenderState | null): boolean {
  if (!left || !right) return left === right
  if (left.bands.length !== right.bands.length) return false
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
    ) {
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

  const refreshRenderState = useCallback(() => {
    const coordinates = coordinatesRef.current
    if (!coordinates?.ready || gammaEntries.length === 0) {
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
      const stripeHeight = clamp(7 + (entry.weight * 22), 8, 30)
      const top = clamp(y - (stripeHeight / 2), 0, Math.max(0, height - stripeHeight))
      const widthPct = clamp(18 + (entry.weight * 38), 16, 62)
      const opacity = clamp(0.08 + (entry.weight * 0.2), 0.08, 0.28)
      bands.push({
        id: `${entry.strike}:${entry.gex}`,
        top,
        height: stripeHeight,
        widthPct,
        color: entry.polarity === 'positive' ? '16,185,129' : '251,113,133',
        opacity,
      })
    }

    const nextState: GammaRenderState = { bands }
    setRenderState((previous) => (renderStateEquals(previous, nextState) ? previous : nextState))
  }, [coordinatesRef, gammaEntries])

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

  if (!renderState || renderState.bands.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[6]" data-testid="spx-gamma-topography" aria-hidden>
      {renderState.bands.map((band) => (
        <div
          key={band.id}
          className="absolute right-0 border-y border-white/5"
          style={{
            top: band.top,
            height: band.height,
            width: `${band.widthPct}%`,
            background: `linear-gradient(270deg, rgba(${band.color}, ${band.opacity}) 0%, rgba(${band.color}, 0) 100%)`,
          }}
        />
      ))}
    </div>
  )
}
