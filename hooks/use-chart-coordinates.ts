'use client'

import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
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
  invalidate: () => void
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
  const coordinatesRef = useRef<ChartCoordinateAPI>({
    priceToPixel: () => null,
    timeToPixel: () => null,
    visiblePriceRange: null,
    chartDimensions: { width: 0, height: 0 },
    ready: false,
  })

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
      return
    }

    const timeScale = chart.timeScale()
    const chartElement = resolveChartElement(chart, fallbackContainerRef)
    const width = chartElement?.clientWidth || 0
    const height = chartElement?.clientHeight || 0

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
      visiblePriceRange: (() => {
        try {
          const range = series.priceScale().getVisibleRange()
          return range ? { min: range.from, max: range.to } : null
        } catch {
          return null
        }
      })(),
      chartDimensions: { width, height },
      ready: width > 0 && height > 0,
    }
  }, [chartRef, fallbackContainerRef, seriesRef])

  useEffect(() => {
    let detached = false
    let attachRafId: number | null = null
    let interactionIntervalId: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let cleanupAttachedListeners: (() => void) | null = null

    const scheduleRecalculate = () => {
      window.requestAnimationFrame(recalculate)
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
      chart.subscribeCrosshairMove(scheduleRecalculate)

      const chartElement = resolveChartElement(chart, fallbackContainerRef)
      if (chartElement) {
        resizeObserver = new ResizeObserver(() => {
          window.requestAnimationFrame(recalculate)
        })
        resizeObserver.observe(chartElement)
        chartElement.addEventListener('pointermove', handleChartInteraction, { passive: true })
        chartElement.addEventListener('pointerup', handleChartInteraction, { passive: true })
        chartElement.addEventListener('wheel', handleChartInteraction, { passive: true })
        chartElement.addEventListener('touchmove', handleChartInteraction, { passive: true })
      }

      // Fallback sampler for interactions that may skip visible-range callbacks.
      interactionIntervalId = window.setInterval(scheduleRecalculate, 180)
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
          chart.unsubscribeCrosshairMove(scheduleRecalculate)
        } catch {
          // no-op
        }
        if (interactionIntervalId != null) {
          window.clearInterval(interactionIntervalId)
        }
        if (chartElement) {
          chartElement.removeEventListener('pointermove', handleChartInteraction)
          chartElement.removeEventListener('pointerup', handleChartInteraction)
          chartElement.removeEventListener('wheel', handleChartInteraction)
          chartElement.removeEventListener('touchmove', handleChartInteraction)
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
      cleanupAttachedListeners?.()
    }
  }, [chartRef, recalculate, fallbackContainerRef])

  return { coordinatesRef, invalidate: recalculate }
}
