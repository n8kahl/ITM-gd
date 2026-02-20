'use client'

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { buildSetupLockGeometry } from '@/lib/spx/spatial-hud'

interface SetupLockOverlayProps {
  coordinatesRef: RefObject<ChartCoordinateAPI>
}

interface SetupBandRender {
  id: string
  top: number
  height: number
  color: string
}

interface SetupLockRenderState {
  centerY: number
  width: number
  bands: SetupBandRender[]
  confluenceRings: number
  direction: 'bullish' | 'bearish'
}

const SETUP_LOCK_REFRESH_INTERVAL_MS = 120

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function renderStateEquals(left: SetupLockRenderState | null, right: SetupLockRenderState | null): boolean {
  if (!left || !right) return left === right
  if (
    left.centerY !== right.centerY
    || left.width !== right.width
    || left.confluenceRings !== right.confluenceRings
    || left.direction !== right.direction
    || left.bands.length !== right.bands.length
  ) {
    return false
  }

  for (let index = 0; index < left.bands.length; index += 1) {
    const l = left.bands[index]
    const r = right.bands[index]
    if (!l || !r) return false
    if (l.id !== r.id || l.top !== r.top || l.height !== r.height || l.color !== r.color) {
      return false
    }
  }

  return true
}

export function SetupLockOverlay({ coordinatesRef }: SetupLockOverlayProps) {
  const { selectedSetup, tradeMode } = useSPXSetupContext()
  const [renderState, setRenderState] = useState<SetupLockRenderState | null>(null)

  const shouldRender = Boolean(selectedSetup && (tradeMode === 'in_trade' || selectedSetup.status === 'ready' || selectedSetup.status === 'triggered'))
  const lockGeometry = useMemo(() => (shouldRender ? buildSetupLockGeometry(selectedSetup) : null), [selectedSetup, shouldRender])

  const refreshRenderState = useCallback(() => {
    const coordinates = coordinatesRef.current
    if (!coordinates?.ready || !selectedSetup || !lockGeometry) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const chartHeight = coordinates.chartDimensions.height
    const chartWidth = coordinates.chartDimensions.width
    if (chartHeight <= 0 || chartWidth <= 0) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const centerY = coordinates.priceToPixel(lockGeometry.centerPrice)
    if (centerY == null) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const bands: SetupBandRender[] = []
    for (const band of lockGeometry.bands) {
      const yHigh = coordinates.priceToPixel(band.high)
      const yLow = coordinates.priceToPixel(band.low)
      if (yHigh == null || yLow == null) continue
      const top = clamp(Math.min(yHigh, yLow), 0, chartHeight)
      const bandHeight = Math.max(2, Math.abs(yLow - yHigh))
      bands.push({
        id: band.id,
        top,
        height: clamp(bandHeight, 2, chartHeight),
        color: band.color,
      })
    }

    const nextState: SetupLockRenderState = {
      centerY,
      width: chartWidth,
      bands,
      confluenceRings: lockGeometry.confluenceRings,
      direction: selectedSetup.direction,
    }

    setRenderState((previous) => (renderStateEquals(previous, nextState) ? previous : nextState))
  }, [coordinatesRef, lockGeometry, selectedSetup])

  useEffect(() => {
    let rafId = 0
    const tick = () => {
      rafId = window.requestAnimationFrame(refreshRenderState)
    }

    tick()
    const intervalId = window.setInterval(tick, SETUP_LOCK_REFRESH_INTERVAL_MS)
    return () => {
      window.clearInterval(intervalId)
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [refreshRenderState])

  if (!renderState || renderState.bands.length === 0) return null

  const reticleX = renderState.width * 0.52
  const ringX = renderState.width * 0.73
  const crosshairColor = renderState.direction === 'bullish' ? '#10B981' : '#FB7185'

  return (
    <div className="pointer-events-none absolute inset-0 z-[18]" data-testid="spx-setup-lock-overlay" aria-hidden>
      {renderState.bands.map((band) => (
        <div
          key={band.id}
          className="absolute inset-x-0 border-y border-white/10"
          style={{
            top: band.top,
            height: band.height,
            background: `linear-gradient(90deg, transparent 0%, ${band.color} 35%, transparent 100%)`,
          }}
        />
      ))}

      <div
        className="absolute inset-x-0 h-[1px] border-t border-dashed border-champagne/65"
        style={{ top: renderState.centerY }}
      />

      <div
        className="absolute w-[1px] border-l border-dashed border-white/30"
        style={{ left: reticleX, top: renderState.centerY - 68, height: 136 }}
      />

      <div
        className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{
          left: reticleX,
          top: renderState.centerY,
          borderColor: `${crosshairColor}99`,
          boxShadow: `0 0 14px ${crosshairColor}44`,
        }}
      />

      {Array.from({ length: renderState.confluenceRings }).map((_, index) => {
        const size = 8 + (index * 8)
        return (
          <div
            key={`ring-${index + 1}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{
              left: ringX,
              top: renderState.centerY,
              width: size,
              height: size,
              borderColor: `${crosshairColor}${index < 2 ? '88' : '44'}`,
            }}
          />
        )
      })}
    </div>
  )
}
