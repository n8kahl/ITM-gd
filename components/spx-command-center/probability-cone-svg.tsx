'use client'

import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'

interface ProbabilityConeSVGProps {
  coordinatesRef: RefObject<ChartCoordinateAPI>
}

interface ConePathState {
  path: string
  centerLine: string
  width: number
  height: number
}

const CONE_REFRESH_INTERVAL_MS = 120

export function ProbabilityConeSVG({ coordinatesRef }: ProbabilityConeSVGProps) {
  const { prediction } = useSPXAnalyticsContext()
  const { spxPrice } = useSPXPriceContext()
  const [coneState, setConeState] = useState<ConePathState | null>(null)
  const rafRef = useRef<number | null>(null)

  const gradientId = useId().replace(/:/g, '')

  useEffect(() => {
    const conePoints = prediction?.probabilityCone || []
    if (conePoints.length === 0 || !Number.isFinite(spxPrice) || spxPrice <= 0) {
      const clearId = window.requestAnimationFrame(() => {
        setConeState(null)
      })
      return () => {
        window.cancelAnimationFrame(clearId)
      }
    }

    const coordinates = coordinatesRef.current
    if (!coordinates?.ready) {
      const clearId = window.requestAnimationFrame(() => {
        setConeState(null)
      })
      return () => {
        window.cancelAnimationFrame(clearId)
      }
    }

    if (coordinates.chartDimensions.width <= 0 || coordinates.chartDimensions.height <= 0) {
      const clearId = window.requestAnimationFrame(() => {
        setConeState(null)
      })
      return () => {
        window.cancelAnimationFrame(clearId)
      }
    }

    if (coordinates.priceToPixel(spxPrice) == null) {
      const clearId = window.requestAnimationFrame(() => {
        setConeState(null)
      })
      return () => {
        window.cancelAnimationFrame(clearId)
      }
    }

    const updatePath = () => {
      const liveCoordinates = coordinatesRef.current
      if (!liveCoordinates?.ready) return
      const { width, height } = liveCoordinates.chartDimensions
      if (width <= 0 || height <= 0) return
      const startY = liveCoordinates.priceToPixel(spxPrice)
      if (startY == null) return

      const startX = width * 0.84
      const coneWidth = width * 0.13
      const topPoints: string[] = []
      const bottomPoints: string[] = []

      for (let index = 0; index < conePoints.length; index += 1) {
        const point = conePoints[index]
        const fraction = (index + 1) / conePoints.length
        const x = startX + (fraction * coneWidth)
        const highY = liveCoordinates.priceToPixel(point.high)
        const lowY = liveCoordinates.priceToPixel(point.low)
        if (highY != null) topPoints.push(`${x},${highY}`)
        if (lowY != null) bottomPoints.push(`${x},${lowY}`)
      }

      if (topPoints.length === 0 || bottomPoints.length === 0) return

      const path = `M${startX},${startY} L${topPoints.join(' L')} L${[...bottomPoints].reverse().join(' L')} Z`
      const endX = startX + coneWidth
      const directionBias = ((prediction?.direction.bullish ?? 0) - (prediction?.direction.bearish ?? 0)) * 2
      const finalWindow = conePoints[conePoints.length - 1]
      const centerTarget = finalWindow
        ? ((finalWindow.high + finalWindow.low) / 2) + directionBias
        : spxPrice
      const centerY = liveCoordinates.priceToPixel(centerTarget)
      const centerLine = centerY == null ? '' : `M${startX},${startY} L${endX},${centerY}`

      setConeState((previous) => {
        if (
          previous
          && previous.path === path
          && previous.centerLine === centerLine
          && previous.width === width
          && previous.height === height
        ) {
          return previous
        }
        return { path, centerLine, width, height }
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
  }, [coordinatesRef, prediction, spxPrice])
  
  useEffect(() => {
    if (prediction?.probabilityCone?.length || (spxPrice > 0 && Number.isFinite(spxPrice))) return
    const clearId = window.requestAnimationFrame(() => {
      setConeState(null)
    })
    return () => {
      window.cancelAnimationFrame(clearId)
    }
  }, [prediction?.probabilityCone?.length, spxPrice])

  if (!coneState) return null

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10"
      width={coneState.width}
      height={coneState.height}
      style={{ overflow: 'visible' }}
      aria-hidden
      data-testid="spx-probability-cone-svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      <path d={coneState.path} fill={`url(#${gradientId})`} stroke="#10B981" strokeOpacity={0.3} strokeWidth={0.5} />
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
