'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
  ColorType,
  CrosshairMode,
  PriceLineSource,
} from 'lightweight-charts'
import type { ChartBar } from '@/lib/api/ai-coach'

// ============================================
// TYPES
// ============================================

export interface LevelAnnotation {
  price: number
  label: string
  color: string
  lineWidth?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
}

interface TradingChartProps {
  bars: ChartBar[]
  levels?: LevelAnnotation[]
  symbol: string
  timeframe: string
  isLoading?: boolean
  onHoverPrice?: (price: number | null) => void
}

// ============================================
// CONSTANTS
// ============================================

// Emerald Standard chart colors
const CHART_COLORS = {
  background: '#0a0f0d',
  textColor: 'rgba(255, 255, 255, 0.5)',
  gridColor: 'rgba(255, 255, 255, 0.03)',
  borderColor: 'rgba(255, 255, 255, 0.05)',
  crosshairColor: 'rgba(16, 185, 129, 0.3)',
  upColor: '#10B981',     // emerald-500
  downColor: '#ef4444',   // red-500
  upWickColor: '#10B981',
  downWickColor: '#ef4444',
  volumeUp: 'rgba(16, 185, 129, 0.15)',
  volumeDown: 'rgba(239, 68, 68, 0.15)',
}

// ============================================
// COMPONENT
// ============================================

export function TradingChart({
  bars,
  levels = [],
  symbol,
  timeframe,
  isLoading,
  onHoverPrice,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  // Initialize chart
  const initChart = useCallback(() => {
    if (!containerRef.current) return

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.textColor,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_COLORS.gridColor },
        horzLines: { color: CHART_COLORS.gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: CHART_COLORS.crosshairColor,
          labelBackgroundColor: '#10B981',
        },
        horzLine: {
          color: CHART_COLORS.crosshairColor,
          labelBackgroundColor: '#10B981',
        },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.borderColor,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: CHART_COLORS.borderColor,
        timeVisible: timeframe !== '1D',
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    })

    // Candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.upColor,
      downColor: CHART_COLORS.downColor,
      borderVisible: false,
      wickUpColor: CHART_COLORS.upWickColor,
      wickDownColor: CHART_COLORS.downWickColor,
      priceLineSource: PriceLineSource.LastBar,
      priceLineColor: '#10B981',
      priceLineWidth: 1,
    })

    // Volume histogram (overlaid at bottom)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    // Configure volume scale
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    chartRef.current = chart
    candlestickSeriesRef.current = candlestickSeries
    volumeSeriesRef.current = volumeSeries

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      chart.applyOptions({ width, height })
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
    }
  }, [timeframe])

  // Initialize chart on mount
  useEffect(() => {
    const cleanup = initChart()
    return () => cleanup?.()
  }, [initChart])

  // Update data when bars change
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || bars.length === 0) return

    // Format candlestick data
    const candleData: CandlestickData<Time>[] = bars.map(bar => ({
      time: bar.time as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }))

    // Format volume data with color based on candle direction
    const volumeData: HistogramData<Time>[] = bars.map(bar => ({
      time: bar.time as Time,
      value: bar.volume,
      color: bar.close >= bar.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
    }))

    candlestickSeriesRef.current.setData(candleData)
    volumeSeriesRef.current.setData(volumeData)

    // Fit content to view
    chartRef.current?.timeScale().fitContent()
  }, [bars])

  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current || !onHoverPrice) return

    const chart = chartRef.current
    const series = candlestickSeriesRef.current
    const handleCrosshairMove = (param: any) => {
      if (!param?.point || !param?.time) {
        onHoverPrice(null)
        return
      }

      const seriesData = param.seriesData?.get(series)
      if (seriesData && typeof seriesData.close === 'number') {
        onHoverPrice(seriesData.close)
        return
      }

      if (typeof param.point.y === 'number') {
        const coordinatePrice = series.coordinateToPrice(param.point.y)
        if (typeof coordinatePrice === 'number' && Number.isFinite(coordinatePrice)) {
          onHoverPrice(coordinatePrice)
          return
        }
      }

      onHoverPrice(null)
    }

    chart.subscribeCrosshairMove(handleCrosshairMove)
    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove)
      onHoverPrice(null)
    }
  }, [onHoverPrice])

  // Update level annotations
  useEffect(() => {
    if (!candlestickSeriesRef.current || levels.length === 0) return

    const series = candlestickSeriesRef.current

    // Remove existing price lines
    const existingLines = (series as any)._priceLines || []
    for (const line of existingLines) {
      series.removePriceLine(line)
    }

    // Add new price lines for each level
    const newLines = levels.map(level => {
      const lineStyle = level.lineStyle === 'dashed' ? 1 : level.lineStyle === 'dotted' ? 2 : 0

      return series.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: (level.lineWidth || 1) as 1 | 2 | 3 | 4,
        lineStyle,
        axisLabelVisible: true,
        title: level.label,
      })
    })

    // Store for cleanup
    ;(series as any)._priceLines = newLines
  }, [levels])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f0d]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <span className="text-xs text-white/40">Loading {symbol} chart...</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && bars.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-white/30">No chart data available</p>
        </div>
      )}
    </div>
  )
}
