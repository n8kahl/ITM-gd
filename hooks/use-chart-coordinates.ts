'use client'

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'

export interface ChartCoordinateAPI {
  priceToPixel: (price: number) => number | null
  timeToPixel: (timestamp: number) => number | null
  visiblePriceRange: { min: number; max: number } | null
  chartDimensions: { width: number; height: number }
  ready: boolean
}

interface UseChartCoordinatesResult {
  coordinatesRef: MutableRefObject<ChartCoordinateAPI>
  coordinatesVersion: number
  invalidate: () => void
}

interface CoordinateSnapshot {
  width: number
  height: number
  ready: boolean
  priceRangeMin: number | null
  priceRangeMax: number | null
  logicalRangeFrom: number | null
  logicalRangeTo: number | null
}

const EMPTY_COORDINATE_SNAPSHOT: CoordinateSnapshot = {
  width: 0,
  height: 0,
  ready: false,
  priceRangeMin: null,
  priceRangeMax: null,
  logicalRangeFrom: null,
  logicalRangeTo: null,
}

function snapshotsEqual(left: CoordinateSnapshot, right: CoordinateSnapshot): boolean {
  return left.width === right.width
    && left.height === right.height
    && left.ready === right.ready
    && left.priceRangeMin === right.priceRangeMin
    && left.priceRangeMax === right.priceRangeMax
    && left.logicalRangeFrom === right.logicalRangeFrom
    && left.logicalRangeTo === right.logicalRangeTo
}

function resolveChartElement(
  chart: IChartApi,
  fallbackContainerRef?: RefObject<HTMLElement | null>,
): HTMLElement | null {
  const fromApi = (chart as { chartElement?: () => HTMLElement | null }).chartElement?.() || null
  if (fromApi) return fromApi
  return fallbackContainerRef?.current || null
}

export function useChartCoordinates(
  chartRef: RefObject<IChartApi | null>,
  seriesRef: RefObject<ISeriesApi<'Candlestick'> | null>,
  fallbackContainerRef?: RefObject<HTMLElement | null>,
): UseChartCoordinatesResult {
  const [coordinatesVersion, setCoordinatesVersion] = useState(0)
  const coordinatesRef = useRef<ChartCoordinateAPI>({
    priceToPixel: () => null,
    timeToPixel: () => null,
    visiblePriceRange: null,
    chartDimensions: { width: 0, height: 0 },
    ready: false,
  })
  const snapshotRef = useRef<CoordinateSnapshot>(EMPTY_COORDINATE_SNAPSHOT)

  const recalculate = useCallback(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) {
      coordinatesRef.current = {
        priceToPixel: () => null,
        timeToPixel: () => null,
        visiblePriceRange: null,
        chartDimensions: { width: 0, height: 0 },
        ready: false,
      }
      if (!snapshotsEqual(snapshotRef.current, EMPTY_COORDINATE_SNAPSHOT)) {
        snapshotRef.current = EMPTY_COORDINATE_SNAPSHOT
        setCoordinatesVersion((previous) => previous + 1)
      }
      return
    }

    const timeScale = chart.timeScale()
    const chartElement = resolveChartElement(chart, fallbackContainerRef)
    const width = chartElement?.clientWidth || 0
    const height = chartElement?.clientHeight || 0
    const visiblePriceRange = (() => {
      try {
        const range = series.priceScale().getVisibleRange()
        return range ? { min: range.from, max: range.to } : null
      } catch {
        return null
      }
    })()
    const visibleLogicalRange = (() => {
      try {
        return timeScale.getVisibleLogicalRange()
      } catch {
        return null
      }
    })()

    coordinatesRef.current = {
      priceToPixel: (price: number) => {
        try {
          const y = series.priceToCoordinate(price)
          return y != null && Number.isFinite(y) ? y : null
        } catch {
          return null
        }
      },
      timeToPixel: (timestamp: number) => {
        try {
          const x = timeScale.timeToCoordinate(timestamp as never)
          return x != null && Number.isFinite(x) ? x : null
        } catch {
          return null
        }
      },
      visiblePriceRange,
      chartDimensions: { width, height },
      ready: width > 0 && height > 0,
    }
    const nextSnapshot: CoordinateSnapshot = {
      width,
      height,
      ready: width > 0 && height > 0,
      priceRangeMin: visiblePriceRange?.min ?? null,
      priceRangeMax: visiblePriceRange?.max ?? null,
      logicalRangeFrom: visibleLogicalRange?.from ?? null,
      logicalRangeTo: visibleLogicalRange?.to ?? null,
    }
    if (!snapshotsEqual(snapshotRef.current, nextSnapshot)) {
      snapshotRef.current = nextSnapshot
      setCoordinatesVersion((previous) => previous + 1)
    }
  }, [chartRef, fallbackContainerRef, seriesRef])

  useEffect(() => {
    let detached = false
    let attachRafId: number | null = null
    let scheduledRafId: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let cleanupAttachedListeners: (() => void) | null = null

    const scheduleRecalculate = () => {
      if (scheduledRafId != null) return
      scheduledRafId = window.requestAnimationFrame(() => {
        scheduledRafId = null
        recalculate()
      })
    }

    const tryAttach = () => {
      if (detached) return
      const chart = chartRef.current
      if (!chart) {
        attachRafId = window.requestAnimationFrame(tryAttach)
        return
      }

      const timeScale = chart.timeScale()
      const handleChartInteraction = () => {
        scheduleRecalculate()
      }

      timeScale.subscribeVisibleLogicalRangeChange(scheduleRecalculate)
      timeScale.subscribeVisibleTimeRangeChange(scheduleRecalculate)

      const chartElement = resolveChartElement(chart, fallbackContainerRef)
      if (chartElement) {
        resizeObserver = new ResizeObserver(() => {
          scheduleRecalculate()
        })
        resizeObserver.observe(chartElement)
        chartElement.addEventListener('pointerdown', handleChartInteraction, { passive: true })
        chartElement.addEventListener('pointerup', handleChartInteraction, { passive: true })
        chartElement.addEventListener('pointercancel', handleChartInteraction, { passive: true })
        chartElement.addEventListener('wheel', handleChartInteraction, { passive: true })
        chartElement.addEventListener('touchstart', handleChartInteraction, { passive: true })
        chartElement.addEventListener('touchmove', handleChartInteraction, { passive: true })
      }

      scheduleRecalculate()

      cleanupAttachedListeners = () => {
        try {
          timeScale.unsubscribeVisibleLogicalRangeChange(scheduleRecalculate)
        } catch {
          // no-op
        }
        try {
          timeScale.unsubscribeVisibleTimeRangeChange(scheduleRecalculate)
        } catch {
          // no-op
        }
        try {
          if (chartElement) {
            chartElement.removeEventListener('pointerdown', handleChartInteraction)
            chartElement.removeEventListener('pointerup', handleChartInteraction)
            chartElement.removeEventListener('pointercancel', handleChartInteraction)
            chartElement.removeEventListener('wheel', handleChartInteraction)
            chartElement.removeEventListener('touchstart', handleChartInteraction)
            chartElement.removeEventListener('touchmove', handleChartInteraction)
          }
        } catch {
          // no-op
        }
        resizeObserver?.disconnect()
      }
    }

    tryAttach()

    return () => {
      detached = true
      if (attachRafId != null) {
        window.cancelAnimationFrame(attachRafId)
      }
      if (scheduledRafId != null) {
        window.cancelAnimationFrame(scheduledRafId)
      }
      cleanupAttachedListeners?.()
    }
  }, [chartRef, recalculate, fallbackContainerRef])

  return { coordinatesRef, coordinatesVersion, invalidate: recalculate }
}
