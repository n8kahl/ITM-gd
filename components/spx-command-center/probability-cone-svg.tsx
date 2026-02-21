'use client'

import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { buildProbabilityConeGeometry, type ProbabilityConeGeometry } from '@/lib/spx/spatial-hud'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'

interface ProbabilityConeSVGProps {
  coordinatesRef: RefObject<ChartCoordinateAPI>
  anchorTimestampSec?: number | null
}

const CONE_REFRESH_INTERVAL_MS = 120
const CONE_CLEAR_AFTER_MISSES = 6

export function ProbabilityConeSVG({ coordinatesRef, anchorTimestampSec }: ProbabilityConeSVGProps) {
  const { prediction } = useSPXAnalyticsContext()
  const { spxPrice, spxTickTimestamp } = useSPXPriceContext()
  const [coneState, setConeState] = useState<ProbabilityConeGeometry | null>(null)
  const rafRef = useRef<number | null>(null)
  const missCountRef = useRef(0)
  const visibilityRef = useRef(false)
  const anchorModeRef = useRef<'time' | 'fallback' | null>(null)

  const gradientId = useId().replace(/:/g, '')

  useEffect(() => {
    if (!Number.isFinite(spxPrice) || spxPrice <= 0) {
      const clearId = window.requestAnimationFrame(() => {
        missCountRef.current = 0
        setConeState(null)
      })
      return () => {
        window.cancelAnimationFrame(clearId)
      }
    }

    const updatePath = () => {
      const liveCoordinates = coordinatesRef.current
      if (!liveCoordinates?.ready) {
        missCountRef.current += 1
        if (missCountRef.current >= CONE_CLEAR_AFTER_MISSES) {
          setConeState(null)
        }
        return
      }
      const { width, height } = liveCoordinates.chartDimensions
      const geometry = buildProbabilityConeGeometry({
        width,
        height,
        currentPrice: spxPrice,
        priceToPixel: liveCoordinates.priceToPixel,
        timeToPixel: liveCoordinates.timeToPixel,
        anchorTimestampSec: anchorTimestampSec
          ?? (spxTickTimestamp ? Math.floor(Date.parse(spxTickTimestamp) / 1000) : Math.floor(Date.now() / 1000)),
        visiblePriceRange: liveCoordinates.visiblePriceRange,
        directionBias: (prediction?.direction.bullish ?? 0) - (prediction?.direction.bearish ?? 0),
        windows: prediction?.probabilityCone || [],
      })

      if (!geometry) {
        missCountRef.current += 1
        if (missCountRef.current >= CONE_CLEAR_AFTER_MISSES) {
          setConeState(null)
        }
        return
      }

      missCountRef.current = 0
      setConeState((previous) => {
        if (!previous) return geometry
        if (
          previous.path === geometry.path
          && previous.centerLine === geometry.centerLine
          && previous.width === geometry.width
          && previous.height === geometry.height
          && previous.usedFallback === geometry.usedFallback
        ) {
          return previous
        }
        return geometry
      })
    }

    const scheduleUpdate = () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current)
      }
      rafRef.current = window.requestAnimationFrame(updatePath)
    }

    scheduleUpdate()
    const intervalId = window.setInterval(scheduleUpdate, CONE_REFRESH_INTERVAL_MS)

    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current)
      }
      window.clearInterval(intervalId)
    }
  }, [anchorTimestampSec, coordinatesRef, prediction?.direction.bearish, prediction?.direction.bullish, prediction?.probabilityCone, spxPrice, spxTickTimestamp])

  useEffect(() => {
    const visible = coneState != null
    if (visible !== visibilityRef.current) {
      visibilityRef.current = visible
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.CONE_VISIBILITY_STATE, {
        visible,
        anchorMode: coneState?.anchorMode || null,
        usedFallbackProjection: coneState?.usedFallback || null,
      })
    }
    if (!coneState) return
    if (anchorModeRef.current !== coneState.anchorMode) {
      anchorModeRef.current = coneState.anchorMode
      if (coneState.anchorMode === 'fallback') {
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SPATIAL_FALLBACK_ANCHOR_USED, {
          surface: 'probability_cone',
          reason: 'time_coordinate_unavailable',
        })
      }
    }
  }, [coneState])

  if (!coneState) return null

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10"
      width={coneState.width}
      height={coneState.height}
      style={{ overflow: 'visible' }}
      aria-hidden
      data-testid="spx-probability-cone-svg"
      data-fallback={coneState.usedFallback ? 'true' : 'false'}
      data-anchor-mode={coneState.anchorMode}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10B981" stopOpacity={0.18 + (coneState.salience * 0.18)} />
          <stop offset="100%" stopColor="#10B981" stopOpacity={0.04 + (coneState.salience * 0.04)} />
        </linearGradient>
      </defs>

      <path
        d={coneState.path}
        fill={`url(#${gradientId})`}
        stroke="#10B981"
        strokeOpacity={0.45 + (coneState.salience * 0.2)}
        strokeWidth={0.8 + (coneState.salience * 0.5)}
        data-testid="spx-probability-cone-path"
      />
      {coneState.anchorMode === 'time' && (
        <circle
          cx={coneState.startX}
          cy={coneState.startY}
          r={2.8 + (coneState.salience * 1.2)}
          fill="#10B981"
          fillOpacity={0.86}
          stroke="#F5EDCC"
          strokeOpacity={0.52}
          strokeWidth={0.9}
          data-testid="spx-probability-cone-start"
        />
      )}
      {coneState.centerLine && (
        <path
          d={coneState.centerLine}
          fill="none"
          stroke="#F5EDCC"
          strokeOpacity={0.42}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}
      {coneState.anchorMode === 'fallback' && (
        <g data-testid="spx-probability-cone-fallback-badge">
          <rect
            x={Math.max(8, coneState.width - 138)}
            y={10}
            width={128}
            height={20}
            rx={6}
            fill="rgba(10,10,11,0.78)"
            stroke="rgba(245,237,204,0.35)"
            strokeWidth={0.8}
          />
          <text
            x={Math.max(16, coneState.width - 130)}
            y={23}
            fill="#F5EDCC"
            fontSize={10}
            fontFamily="Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
            opacity={0.86}
          >
            CONE FALLBACK
          </text>
        </g>
      )}
    </svg>
  )
}
