'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { buildSetupLockGeometry, parseIsoToUnixSeconds, resolveSetupLockState, type SetupLockState } from '@/lib/spx/spatial-hud'

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
  centerX: number
  ringX: number
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
    left.centerX !== right.centerX
    || left.ringX !== right.ringX
    || left.centerY !== right.centerY
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
  const [showPulse, setShowPulse] = useState(false)
  const [pulseTick, setPulseTick] = useState(0)
  const pulseTimeoutRef = useRef<number | null>(null)
  const previousStateRef = useRef<SetupLockState>('idle')

  const shouldRender = Boolean(selectedSetup && (tradeMode === 'in_trade' || selectedSetup.status === 'ready' || selectedSetup.status === 'triggered'))
  const lockGeometry = useMemo(() => (shouldRender ? buildSetupLockGeometry(selectedSetup) : null), [selectedSetup, shouldRender])
  const lockState = resolveSetupLockState(tradeMode, selectedSetup?.status)
  const lockAnchorTimeSec = useMemo(() => {
    if (!selectedSetup) return null
    return parseIsoToUnixSeconds(selectedSetup.statusUpdatedAt)
      ?? parseIsoToUnixSeconds(selectedSetup.triggeredAt)
      ?? parseIsoToUnixSeconds(selectedSetup.createdAt)
  }, [selectedSetup])

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
    const fallbackCenterX = chartWidth * 0.52
    const anchorX = lockAnchorTimeSec != null ? coordinates.timeToPixel(lockAnchorTimeSec) : null
    const centerX = clamp(anchorX ?? fallbackCenterX, 16, Math.max(16, chartWidth - 16))
    const ringX = clamp(centerX + Math.min(chartWidth * 0.21, 168), 18, Math.max(18, chartWidth - 18))

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
      centerX,
      ringX,
      centerY,
      width: chartWidth,
      bands,
      confluenceRings: lockGeometry.confluenceRings,
      direction: selectedSetup.direction,
    }

    setRenderState((previous) => (renderStateEquals(previous, nextState) ? previous : nextState))
  }, [coordinatesRef, lockAnchorTimeSec, lockGeometry, selectedSetup])

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

  useEffect(() => {
    const previous = previousStateRef.current
    if (previous === lockState) return
    previousStateRef.current = lockState

    if (lockState === 'idle') return

    if (pulseTimeoutRef.current != null) {
      window.clearTimeout(pulseTimeoutRef.current)
    }
    let rafId = 0
    rafId = window.requestAnimationFrame(() => {
      setPulseTick((previousTick) => previousTick + 1)
      setShowPulse(true)
      pulseTimeoutRef.current = window.setTimeout(() => {
        setShowPulse(false)
        pulseTimeoutRef.current = null
      }, 900)
    })

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SETUP_LOCK_STATE_CHANGED, {
      setupId: selectedSetup?.id || null,
      previousState: previous,
      nextState: lockState,
      tradeMode,
      setupStatus: selectedSetup?.status || null,
    })
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SETUP_LOCK_PULSE_PLAYED, {
      setupId: selectedSetup?.id || null,
      nextState: lockState,
    })
    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [lockState, selectedSetup?.id, selectedSetup?.status, tradeMode])

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current != null) {
        window.clearTimeout(pulseTimeoutRef.current)
      }
    }
  }, [])

  if (!renderState || renderState.bands.length === 0) return null

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
        style={{ left: renderState.centerX, top: renderState.centerY - 68, height: 136 }}
      />

      <div
        className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{
          left: renderState.centerX,
          top: renderState.centerY,
          borderColor: `${crosshairColor}99`,
          boxShadow: `0 0 14px ${crosshairColor}44`,
        }}
      />

      {showPulse && (
        <div
          key={`setup-lock-pulse-${pulseTick}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-champagne/60"
          style={{
            left: renderState.centerX,
            top: renderState.centerY,
            width: 28,
            height: 28,
            animation: 'spatial-lock-burst 850ms ease-out forwards',
          }}
          data-testid="spx-setup-lock-pulse"
        />
      )}

      {Array.from({ length: renderState.confluenceRings }).map((_, index) => {
        const size = 8 + (index * 8)
        return (
          <div
            key={`ring-${index + 1}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{
                left: renderState.ringX,
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
