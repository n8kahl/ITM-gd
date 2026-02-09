'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
  ColorType,
  CrosshairMode,
  PriceLineSource,
} from 'lightweight-charts'
import type { ChartBar, ChartProviderIndicators } from '@/lib/api/ai-coach'
import {
  calculateEMA,
  calculateMACDSeries,
  calculateOpeningRangeBox,
  calculateRSISeries,
  calculateVWAPSeries,
  DEFAULT_INDICATOR_CONFIG,
  type IndicatorConfig,
} from './chart-indicators'

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
  providerIndicators?: ChartProviderIndicators
  indicators?: IndicatorConfig
  positionOverlays?: PositionOverlay[]
  symbol: string
  timeframe: string
  isLoading?: boolean
  onHoverPrice?: (price: number | null) => void
}

export interface PositionOverlay {
  id?: string
  entry: number
  stop?: number
  target?: number
  label?: string
}

interface NormalizedIndicatorPoint {
  time: number
  value: number
  signal?: number
  histogram?: number
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
  ema8: '#38bdf8',
  ema21: '#f59e0b',
  vwap: '#eab308',
  openingRange: '#a78bfa',
  entry: '#22c55e',
  stop: '#ef4444',
  target: '#22d3ee',
  rsi: '#a78bfa',
  rsiOverbought: '#ef4444',
  rsiOversold: '#10b981',
  macd: '#60a5fa',
  macdSignal: '#f59e0b',
  macdPositive: 'rgba(16, 185, 129, 0.35)',
  macdNegative: 'rgba(239, 68, 68, 0.35)',
}

// ============================================
// COMPONENT
// ============================================

export function TradingChart({
  bars,
  levels = [],
  providerIndicators,
  indicators = DEFAULT_INDICATOR_CONFIG,
  positionOverlays = [],
  symbol,
  timeframe,
  isLoading,
  onHoverPrice,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rsiContainerRef = useRef<HTMLDivElement>(null)
  const macdContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const rsiChartRef = useRef<IChartApi | null>(null)
  const macdChartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const ema8SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdSignalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdHistogramSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const safeBars = bars
    .filter((bar) => (
      Number.isFinite(bar.time)
      && Number.isFinite(bar.open)
      && Number.isFinite(bar.high)
      && Number.isFinite(bar.low)
      && Number.isFinite(bar.close)
    ))
    .sort((a, b) => a.time - b.time)
    .reduce<ChartBar[]>((acc, bar) => {
      const prev = acc[acc.length - 1]
      if (prev?.time === bar.time) {
        acc[acc.length - 1] = bar
      } else {
        acc.push(bar)
      }
      return acc
    }, [])
  const minBarTime = safeBars.length > 0 ? safeBars[0].time : null
  const maxBarTime = safeBars.length > 0 ? safeBars[safeBars.length - 1].time : null

  const normalizeIndicatorPoints = useCallback((
    points: Array<{ time: number; value: number; signal?: number; histogram?: number }> | undefined,
  ): NormalizedIndicatorPoint[] => {
    if (!points || points.length === 0) return []

    const sanitized = points
      .filter((point) => (
        Number.isFinite(point.time)
        && Number.isFinite(point.value)
        && (point.signal === undefined || Number.isFinite(point.signal))
        && (point.histogram === undefined || Number.isFinite(point.histogram))
      ))
      .sort((a, b) => a.time - b.time)
      .reduce<NormalizedIndicatorPoint[]>((acc, point) => {
        const prev = acc[acc.length - 1]
        if (prev?.time === point.time) {
          acc[acc.length - 1] = {
            time: point.time,
            value: point.value,
            signal: point.signal,
            histogram: point.histogram,
          }
        } else {
          acc.push({
            time: point.time,
            value: point.value,
            signal: point.signal,
            histogram: point.histogram,
          })
        }
        return acc
      }, [])

    if (minBarTime == null || maxBarTime == null) {
      return sanitized
    }

    return sanitized.filter((point) => point.time >= minBarTime && point.time <= maxBarTime)
  }, [maxBarTime, minBarTime])

  const buildRSIData = useCallback((): LineData<Time>[] => {
    const provider = normalizeIndicatorPoints(providerIndicators?.rsi14)
    if (provider && provider.length > 0) {
      return provider.map((point) => ({
        time: point.time as Time,
        value: point.value,
      }))
    }

    return calculateRSISeries(safeBars, 14).map((point) => ({
      time: point.time as Time,
      value: point.value,
    }))
  }, [normalizeIndicatorPoints, providerIndicators, safeBars])

  const buildMACDData = useCallback((): {
    macd: LineData<Time>[]
    signal: LineData<Time>[]
    histogram: HistogramData<Time>[]
  } => {
    const provider = normalizeIndicatorPoints(providerIndicators?.macd)
    if (provider && provider.length > 0) {
      return {
        macd: provider.map((point) => ({ time: point.time as Time, value: point.value })),
        signal: provider.map((point) => ({ time: point.time as Time, value: point.signal ?? 0 })),
        histogram: provider.map((point) => ({
          time: point.time as Time,
          value: point.histogram ?? 0,
          color: (point.histogram ?? 0) >= 0 ? CHART_COLORS.macdPositive : CHART_COLORS.macdNegative,
        })),
      }
    }

    const fallback = calculateMACDSeries(safeBars)
    return {
      macd: fallback.macd.map((point) => ({ time: point.time as Time, value: point.value })),
      signal: fallback.signal.map((point) => ({ time: point.time as Time, value: point.value })),
      histogram: fallback.macd.map((point, index) => {
        const signalPoint = fallback.signal[index]
        const histogram = point.value - (signalPoint?.value ?? 0)
        return {
          time: point.time as Time,
          value: histogram,
          color: histogram >= 0 ? CHART_COLORS.macdPositive : CHART_COLORS.macdNegative,
        }
      }),
    }
  }, [normalizeIndicatorPoints, providerIndicators, safeBars])

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

    const ema8Series = chart.addSeries(LineSeries, {
      color: CHART_COLORS.ema8,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const ema21Series = chart.addSeries(LineSeries, {
      color: CHART_COLORS.ema21,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const vwapSeries = chart.addSeries(LineSeries, {
      color: CHART_COLORS.vwap,
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // Configure volume scale
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    chartRef.current = chart
    candlestickSeriesRef.current = candlestickSeries
    volumeSeriesRef.current = volumeSeries
    ema8SeriesRef.current = ema8Series
    ema21SeriesRef.current = ema21Series
    vwapSeriesRef.current = vwapSeries

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

  useEffect(() => {
    if (!indicators.rsi) {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove()
        rsiChartRef.current = null
      }
      rsiSeriesRef.current = null
      return
    }

    if (!rsiContainerRef.current) return

    if (rsiChartRef.current) {
      rsiChartRef.current.remove()
      rsiChartRef.current = null
    }

    const chart = createChart(rsiContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.textColor,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: CHART_COLORS.gridColor },
        horzLines: { color: CHART_COLORS.gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.borderColor,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        visible: false,
        borderColor: CHART_COLORS.borderColor,
      },
      handleScroll: false,
      handleScale: false,
    })

    const rsiSeries = chart.addSeries(LineSeries, {
      color: CHART_COLORS.rsi,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    rsiSeries.createPriceLine({
      price: 70,
      color: CHART_COLORS.rsiOverbought,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: false,
      title: '70',
    })
    rsiSeries.createPriceLine({
      price: 30,
      color: CHART_COLORS.rsiOversold,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: false,
      title: '30',
    })

    rsiChartRef.current = chart
    rsiSeriesRef.current = rsiSeries

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      chart.applyOptions({ width, height })
    })
    resizeObserver.observe(rsiContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      rsiChartRef.current = null
      rsiSeriesRef.current = null
    }
  }, [indicators.rsi, timeframe])

  useEffect(() => {
    if (!indicators.macd) {
      if (macdChartRef.current) {
        macdChartRef.current.remove()
        macdChartRef.current = null
      }
      macdSeriesRef.current = null
      macdSignalSeriesRef.current = null
      macdHistogramSeriesRef.current = null
      return
    }

    if (!macdContainerRef.current) return

    if (macdChartRef.current) {
      macdChartRef.current.remove()
      macdChartRef.current = null
    }

    const chart = createChart(macdContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.textColor,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: CHART_COLORS.gridColor },
        horzLines: { color: CHART_COLORS.gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.borderColor,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        visible: false,
        borderColor: CHART_COLORS.borderColor,
      },
      handleScroll: false,
      handleScale: false,
    })

    const histogramSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const macdSeries = chart.addSeries(LineSeries, {
      color: CHART_COLORS.macd,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const signalSeries = chart.addSeries(LineSeries, {
      color: CHART_COLORS.macdSignal,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    macdSeries.createPriceLine({
      price: 0,
      color: CHART_COLORS.borderColor,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: false,
      title: '0',
    })

    macdChartRef.current = chart
    macdHistogramSeriesRef.current = histogramSeries
    macdSeriesRef.current = macdSeries
    macdSignalSeriesRef.current = signalSeries

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      chart.applyOptions({ width, height })
    })
    resizeObserver.observe(macdContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      macdChartRef.current = null
      macdHistogramSeriesRef.current = null
      macdSeriesRef.current = null
      macdSignalSeriesRef.current = null
    }
  }, [indicators.macd, timeframe])

  useEffect(() => {
    const mainChart = chartRef.current
    if (!mainChart) return

    const syncRange = (range: any) => {
      if (!range) return
      if (rsiChartRef.current) {
        rsiChartRef.current.timeScale().setVisibleLogicalRange(range)
      }
      if (macdChartRef.current) {
        macdChartRef.current.timeScale().setVisibleLogicalRange(range)
      }
    }

    mainChart.timeScale().subscribeVisibleLogicalRangeChange(syncRange)
    return () => {
      mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncRange)
    }
  }, [indicators.rsi, indicators.macd])

  // Update data when bars change
  useEffect(() => {
    if (
      !candlestickSeriesRef.current
      || !volumeSeriesRef.current
      || !ema8SeriesRef.current
      || !ema21SeriesRef.current
      || !vwapSeriesRef.current
    ) return

    // Format candlestick data
    const candleData: CandlestickData<Time>[] = safeBars.map(bar => ({
      time: bar.time as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }))

    // Format volume data with color based on candle direction
    const volumeData: HistogramData<Time>[] = safeBars.map(bar => ({
      time: bar.time as Time,
      value: Number.isFinite(bar.volume) ? bar.volume : 0,
      color: bar.close >= bar.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
    }))

    candlestickSeriesRef.current.setData(candleData)
    volumeSeriesRef.current.setData(volumeData)

    const ema8Data: LineData<Time>[] = indicators.ema8
      ? calculateEMA(safeBars, 8).map((point) => ({
        time: point.time as Time,
        value: point.value,
      }))
      : []
    const ema21Data: LineData<Time>[] = indicators.ema21
      ? calculateEMA(safeBars, 21).map((point) => ({
        time: point.time as Time,
        value: point.value,
      }))
      : []
    const vwapData: LineData<Time>[] = indicators.vwap
      ? calculateVWAPSeries(safeBars).map((point) => ({
        time: point.time as Time,
        value: point.value,
      }))
      : []

    ema8SeriesRef.current.setData(ema8Data)
    ema21SeriesRef.current.setData(ema21Data)
    vwapSeriesRef.current.setData(vwapData)

    if (rsiSeriesRef.current) {
      const rsiData = indicators.rsi ? buildRSIData() : []
      rsiSeriesRef.current.setData(rsiData)
    }

    if (macdSeriesRef.current && macdSignalSeriesRef.current && macdHistogramSeriesRef.current) {
      if (indicators.macd) {
        const macdData = buildMACDData()
        macdSeriesRef.current.setData(macdData.macd)
        macdSignalSeriesRef.current.setData(macdData.signal)
        macdHistogramSeriesRef.current.setData(macdData.histogram)
      } else {
        macdSeriesRef.current.setData([])
        macdSignalSeriesRef.current.setData([])
        macdHistogramSeriesRef.current.setData([])
      }
    }

    // Fit content to view
    chartRef.current?.timeScale().fitContent()
    rsiChartRef.current?.timeScale().fitContent()
    macdChartRef.current?.timeScale().fitContent()
  }, [safeBars, indicators, buildRSIData, buildMACDData])

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
    if (!candlestickSeriesRef.current) return

    const series = candlestickSeriesRef.current

    // Remove existing price lines
    const existingLines = (series as any)._priceLines || []
    for (const line of existingLines) {
      series.removePriceLine(line)
    }

    const derivedLevels: LevelAnnotation[] = [...levels]

    if (indicators.openingRange) {
      const openingRange = calculateOpeningRangeBox(safeBars, timeframe)
      if (openingRange) {
        derivedLevels.push({
          price: openingRange.high,
          label: 'OR High',
          color: CHART_COLORS.openingRange,
          lineWidth: 1,
          lineStyle: 'dotted',
        })
        derivedLevels.push({
          price: openingRange.low,
          label: 'OR Low',
          color: CHART_COLORS.openingRange,
          lineWidth: 1,
          lineStyle: 'dotted',
        })
      }
    }

    for (const position of positionOverlays) {
      const label = position.label || 'Position'
      derivedLevels.push({
        price: position.entry,
        label: `${label} Entry`,
        color: CHART_COLORS.entry,
        lineWidth: 2,
        lineStyle: 'solid',
      })

      if (typeof position.stop === 'number') {
        derivedLevels.push({
          price: position.stop,
          label: `${label} Stop`,
          color: CHART_COLORS.stop,
          lineWidth: 1,
          lineStyle: 'dashed',
        })
      }

      if (typeof position.target === 'number') {
        derivedLevels.push({
          price: position.target,
          label: `${label} Target`,
          color: CHART_COLORS.target,
          lineWidth: 1,
          lineStyle: 'dashed',
        })
      }
    }

    // Add new price lines for each level
    const newLines = derivedLevels.map(level => {
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
  }, [levels, indicators.openingRange, safeBars, timeframe, positionOverlays])

  const showRSIPane = indicators.rsi
  const showMACDPane = indicators.macd

  return (
    <div className="relative w-full h-full">
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1">
          <div ref={containerRef} className="h-full w-full" />
        </div>

        {showRSIPane && (
          <div className="relative h-28 border-t border-white/10">
            <div ref={rsiContainerRef} className="h-full w-full" />
            <div className="pointer-events-none absolute left-2 top-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/55">
              RSI (14)
            </div>
          </div>
        )}

        {showMACDPane && (
          <div className="relative h-28 border-t border-white/10">
            <div ref={macdContainerRef} className="h-full w-full" />
            <div className="pointer-events-none absolute left-2 top-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/55">
              MACD (12,26,9)
            </div>
          </div>
        )}
      </div>

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
      {!isLoading && safeBars.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-white/30">No chart data available</p>
        </div>
      )}
    </div>
  )
}
