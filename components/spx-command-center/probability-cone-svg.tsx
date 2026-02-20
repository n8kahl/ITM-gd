'use client'

import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { buildProbabilityConeGeometry, type ProbabilityConeGeometry } from '@/lib/spx/spatial-hud'

interface ProbabilityConeSVGProps {
  coordinatesRef: RefObject<ChartCoordinateAPI>
}

const CONE_REFRESH_INTERVAL_MS = 120
const CONE_CLEAR_AFTER_MISSES = 6

export function ProbabilityConeSVG({ coordinatesRef }: ProbabilityConeSVGProps) {
  const { prediction } = useSPXAnalyticsContext()
  const { spxPrice } = useSPXPriceContext()
  const [coneState, setConeState] = useState<ProbabilityConeGeometry | null>(null)
  const rafRef = useRef<number | null>(null)
  const missCountRef = useRef(0)

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
  }, [coordinatesRef, prediction?.direction.bearish, prediction?.direction.bullish, prediction?.probabilityCone, spxPrice])

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
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      <path
        d={coneState.path}
        fill={`url(#${gradientId})`}
        stroke="#10B981"
        strokeOpacity={0.32}
        strokeWidth={0.5}
        data-testid="spx-probability-cone-path"
      />
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
    </svg>
  )
}
