'use client'

import { useEffect, useRef, useCallback, useMemo } from 'react'
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
  TickMarkType,
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
import type { LevelGroupId } from './chart-level-groups'
import { resolveVisibleChartLevels, type VisibleChartLevelsResult } from '@/lib/spx/spatial-hud'
import type { SPXLevelVisibilityBudget } from '@/lib/spx/overlay-priority'
import { cn } from '@/lib/utils'

// ============================================
// TYPES
// ============================================

export interface LevelAnnotation {
  price: number
  label: string
  color: string
  lineWidth?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  axisLabelVisible?: boolean
  type?: string
  side?: 'resistance' | 'support'
  strength?: 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical'
  description?: string
  testsToday?: number
  lastTest?: string | null
  holdRate?: number | null
  displayContext?: string
  group?: LevelGroupId
}

interface TradingChartProps {
  bars: ChartBar[]
  levels?: LevelAnnotation[]
  providerIndicators?: ChartProviderIndicators
  indicators?: IndicatorConfig
  openingRangeMinutes?: 5 | 15 | 30
  positionOverlays?: PositionOverlay[]
  eventMarkers?: ChartEventMarker[]
  symbol: string
  timeframe: string
  futureOffsetBars?: number
  isLoading?: boolean
  levelVisibilityBudget?: SPXLevelVisibilityBudget
  onHoverPrice?: (price: number | null) => void
  onCrosshairSnapshot?: (snapshot: TradingChartCrosshairSnapshot | null) => void
  onChartReady?: (chart: IChartApi, series: ISeriesApi<'Candlestick'>) => void
  onLevelLayoutStats?: (stats: VisibleChartLevelsResult<LevelAnnotation>['stats']) => void
}

export interface TradingChartCrosshairSnapshot {
  timeSec: number
  open: number
  high: number
  low: number
  close: number
  volume: number | null
}

export interface PositionOverlay {
  id?: string
  entry: number
  stop?: number
  target?: number
  targets?: number[]
  label?: string
}

export interface ChartEventMarker {
  label: string
  date?: string
  impact?: 'high' | 'medium' | 'low' | 'info'
  source?: string
}

interface NormalizedIndicatorPoint {
  time: number
  value: number
  signal?: number
  histogram?: number
}

function isDisposedError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('disposed')
}

// ============================================
// CONSTANTS
// ============================================

// Emerald Standard chart colors
const CHART_COLORS = {
  background: '#0a0f0d',
  textColor: 'rgba(255, 255, 255, 0.64)',
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

const CHART_DISPLAY_TIMEZONE = 'America/New_York'
const ET_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: CHART_DISPLAY_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const ET_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: CHART_DISPLAY_TIMEZONE,
  month: 'short',
  day: 'numeric',
})

function toUnixSecondsFromChartTime(time: Time): number | null {
  if (typeof time === 'number' && Number.isFinite(time)) {
    return Math.floor(time)
  }
  if (typeof time === 'string') {
    const parsed = Date.parse(time)
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000)
    return null
  }
  if (time && typeof time === 'object' && 'year' in time && 'month' in time && 'day' in time) {
    const date = new Date(Date.UTC(time.year, time.month - 1, time.day))
    return Math.floor(date.getTime() / 1000)
  }
  return null
}

function formatChartTickInEt(time: Time, timeframe: string, tickMarkType?: TickMarkType): string {
  const unixSeconds = toUnixSecondsFromChartTime(time)
  if (unixSeconds == null) return ''

  const date = new Date(unixSeconds * 1000)
  const isIntraday = timeframe !== '1D'
  if (!isIntraday) {
    return ET_DATE_FORMATTER.format(date)
  }

  if (
    tickMarkType === TickMarkType.DayOfMonth
    || tickMarkType === TickMarkType.Month
    || tickMarkType === TickMarkType.Year
  ) {
    return ET_DATE_FORMATTER.format(date)
  }

  return ET_TIME_FORMATTER.format(date)
}

// ============================================
// COMPONENT
// ============================================

export function TradingChart({
  bars,
  levels = [],
  providerIndicators,
  indicators = DEFAULT_INDICATOR_CONFIG,
  openingRangeMinutes = 15,
  positionOverlays = [],
  eventMarkers = [],
  symbol,
  timeframe,
  futureOffsetBars = 12,
  isLoading,
  levelVisibilityBudget,
  onHoverPrice,
  onCrosshairSnapshot,
  onChartReady,
  onLevelLayoutStats,
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
  const levelPriceLinesRef = useRef<any[]>([])
  const userAdjustedViewportRef = useRef(false)
  const manualPriceScaleRef = useRef(false)
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
  const resolvedLevelVisibilityBudget = levelVisibilityBudget || {
    nearWindowPoints: 16,
    nearLabelBudget: 7,
    maxTotalLabels: 16,
    minGapPoints: 1.2,
    pixelCollisionGap: 16,
  }

  const timelineMarkers = useMemo(() => {
    if (eventMarkers.length === 0 || safeBars.length === 0) return []

    const toUnixSeconds = (value: string | undefined): number | null => {
      if (!value) return null
      const parsed = Date.parse(value)
      if (!Number.isFinite(parsed)) return null
      return Math.floor(parsed / 1000)
    }

    const barsCount = safeBars.length
    const maxMarkers = 6
    const dedupe = new Set<string>()
    const markers: Array<{
      label: string
      leftPct: number
      impact: 'high' | 'medium' | 'low' | 'info'
      source?: string
    }> = []

    for (const marker of eventMarkers.slice(0, maxMarkers)) {
      const rawLabel = String(marker.label || '').trim()
      if (!rawLabel) continue

      const key = `${rawLabel.toLowerCase()}|${(marker.date || '').toLowerCase()}`
      if (dedupe.has(key)) continue
      dedupe.add(key)

      const target = toUnixSeconds(marker.date) ?? safeBars[barsCount - 1]!.time
      let nearestIndex = 0
      let nearestDistance = Number.POSITIVE_INFINITY

      for (let i = 0; i < barsCount; i += 1) {
        const distance = Math.abs(safeBars[i]!.time - target)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestIndex = i
        }
      }

      const leftPct = barsCount <= 1 ? 50 : (nearestIndex / (barsCount - 1)) * 100
      const impact = marker.impact || 'info'
      markers.push({
        label: rawLabel.length > 22 ? `${rawLabel.slice(0, 22)}...` : rawLabel,
        leftPct,
        impact,
        source: marker.source,
      })
    }

    return markers
  }, [eventMarkers, safeBars])

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

  const clearLevelPriceLines = useCallback((series: ISeriesApi<'Candlestick'> | null) => {
    if (!series || levelPriceLinesRef.current.length === 0) {
      levelPriceLinesRef.current = []
      return
    }

    for (const line of levelPriceLinesRef.current) {
      try {
        series.removePriceLine(line)
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to remove level price line', error)
        }
      }
    }

    levelPriceLinesRef.current = []
  }, [])

  const resetMainChartRefs = useCallback(() => {
    candlestickSeriesRef.current = null
    volumeSeriesRef.current = null
    ema8SeriesRef.current = null
    ema21SeriesRef.current = null
    vwapSeriesRef.current = null
    levelPriceLinesRef.current = []
  }, [])

  // Initialize chart
  const initChart = useCallback(() => {
    if (!containerRef.current) return

    // Clean up existing chart
    if (chartRef.current) {
      clearLevelPriceLines(candlestickSeriesRef.current)
      resetMainChartRefs()
      try {
        chartRef.current.remove()
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to remove existing chart', error)
        }
      }
      chartRef.current = null
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.textColor,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 11,
      },
      localization: {
        locale: 'en-US',
        timeFormatter: (time: Time) => formatChartTickInEt(time, timeframe),
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
        rightOffset: futureOffsetBars,
        barSpacing: timeframe === '1D' ? 8 : 6,
        minBarSpacing: 3,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: false,
        shiftVisibleRangeOnNewBar: true,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => (
          formatChartTickInEt(time, timeframe, tickMarkType)
        ),
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
    })

    const markUserViewportAdjusted = () => {
      userAdjustedViewportRef.current = true
    }

    const enableManualPriceScale = () => {
      if (manualPriceScaleRef.current) return
      try {
        chart.priceScale('right').applyOptions({ autoScale: false })
        manualPriceScaleRef.current = true
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to disable right autoScale after vertical drag', error)
        }
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      markUserViewportAdjusted()
      // Disable autoscale as soon as the user begins a drag so vertical pan works immediately.
      enableManualPriceScale()
    }

    let touchStartY: number | null = null
    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? null
      markUserViewportAdjusted()
      enableManualPriceScale()
    }
    const handleTouchMove = (event: TouchEvent) => {
      if (touchStartY == null) return
      const currentY = event.touches[0]?.clientY
      if (currentY == null) return
      if (Math.abs(currentY - touchStartY) >= 4) {
        enableManualPriceScale()
      }
    }
    const clearTouchStart = () => {
      touchStartY = null
    }

    containerRef.current.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true })
    containerRef.current.addEventListener('wheel', markUserViewportAdjusted, { capture: true, passive: true })
    containerRef.current.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true })
    containerRef.current.addEventListener('touchmove', handleTouchMove, { capture: true, passive: true })
    containerRef.current.addEventListener('touchend', clearTouchStart, { capture: true, passive: true })
    containerRef.current.addEventListener('touchcancel', clearTouchStart, { capture: true, passive: true })

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
    onChartReady?.(chart, candlestickSeries)

    // Handle resize
    let resizeTimeoutId: number | null = null
    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (resizeTimeoutId != null) {
        window.clearTimeout(resizeTimeoutId)
      }
      resizeTimeoutId = window.setTimeout(() => {
        try {
          chart.applyOptions({ width, height })
        } catch (error) {
          if (!isDisposedError(error)) {
            console.warn('[TradingChart] Failed to resize main chart', error)
          }
        }
      }, 50)
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      if (resizeTimeoutId != null) {
        window.clearTimeout(resizeTimeoutId)
      }
      resizeObserver.disconnect()
      containerRef.current?.removeEventListener('pointerdown', handlePointerDown, true)
      containerRef.current?.removeEventListener('wheel', markUserViewportAdjusted, true)
      containerRef.current?.removeEventListener('touchstart', handleTouchStart, true)
      containerRef.current?.removeEventListener('touchmove', handleTouchMove, true)
      containerRef.current?.removeEventListener('touchend', clearTouchStart, true)
      containerRef.current?.removeEventListener('touchcancel', clearTouchStart, true)
      clearLevelPriceLines(candlestickSeriesRef.current)
      resetMainChartRefs()
      try {
        chart.remove()
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to cleanup main chart', error)
        }
      }
      if (chartRef.current === chart) {
        chartRef.current = null
      }
    }
  }, [timeframe, futureOffsetBars, clearLevelPriceLines, resetMainChartRefs, onChartReady])

  // Initialize chart on mount
  useEffect(() => {
    const cleanup = initChart()
    return () => cleanup?.()
  }, [initChart])

  useEffect(() => {
    if (!chartRef.current) return
    try {
      chartRef.current.applyOptions({
        timeScale: {
          rightOffset: futureOffsetBars,
        },
      })
    } catch (error) {
      if (!isDisposedError(error)) {
        console.warn('[TradingChart] Failed to update future lane offset', error)
      }
    }
  }, [futureOffsetBars])

  useEffect(() => {
    userAdjustedViewportRef.current = false
    manualPriceScaleRef.current = false
    if (chartRef.current) {
      try {
        chartRef.current.priceScale('right').applyOptions({ autoScale: true })
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to reset right autoScale on symbol/timeframe change', error)
        }
      }
    }
  }, [symbol, timeframe])

  useEffect(() => {
    if (!indicators.rsi) {
      if (rsiChartRef.current) {
        try {
          rsiChartRef.current.remove()
        } catch (error) {
          if (!isDisposedError(error)) {
            console.warn('[TradingChart] Failed to remove RSI chart', error)
          }
        }
        rsiChartRef.current = null
      }
      rsiSeriesRef.current = null
      return
    }

    if (!rsiContainerRef.current) return

    if (rsiChartRef.current) {
      try {
        rsiChartRef.current.remove()
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to replace RSI chart', error)
        }
      }
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
      try {
        chart.applyOptions({ width, height })
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to resize RSI chart', error)
        }
      }
    })
    resizeObserver.observe(rsiContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      try {
        chart.remove()
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to cleanup RSI chart', error)
        }
      }
      rsiChartRef.current = null
      rsiSeriesRef.current = null
    }
  }, [indicators.rsi, timeframe])

  useEffect(() => {
    if (!indicators.macd) {
      if (macdChartRef.current) {
        try {
          macdChartRef.current.remove()
        } catch (error) {
          if (!isDisposedError(error)) {
            console.warn('[TradingChart] Failed to remove MACD chart', error)
          }
        }
        macdChartRef.current = null
      }
      macdSeriesRef.current = null
      macdSignalSeriesRef.current = null
      macdHistogramSeriesRef.current = null
      return
    }

    if (!macdContainerRef.current) return

    if (macdChartRef.current) {
      try {
        macdChartRef.current.remove()
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to replace MACD chart', error)
        }
      }
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
      try {
        chart.applyOptions({ width, height })
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to resize MACD chart', error)
        }
      }
    })
    resizeObserver.observe(macdContainerRef.current)

    return () => {
      resizeObserver.disconnect()
      try {
        chart.remove()
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to cleanup MACD chart', error)
        }
      }
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
        try {
          rsiChartRef.current.timeScale().setVisibleLogicalRange(range)
        } catch (error) {
          if (!isDisposedError(error)) {
            console.warn('[TradingChart] Failed to sync RSI range', error)
          }
        }
      }
      if (macdChartRef.current) {
        try {
          macdChartRef.current.timeScale().setVisibleLogicalRange(range)
        } catch (error) {
          if (!isDisposedError(error)) {
            console.warn('[TradingChart] Failed to sync MACD range', error)
          }
        }
      }
    }

    mainChart.timeScale().subscribeVisibleLogicalRangeChange(syncRange)
    return () => {
      try {
        mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncRange)
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to unsubscribe range sync', error)
        }
      }
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

    try {
      candlestickSeriesRef.current.setData(candleData)
      volumeSeriesRef.current.setData(volumeData)
    } catch (error) {
      if (!isDisposedError(error)) {
        console.warn('[TradingChart] Failed to set main series data', error)
      }
      return
    }

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

    try {
      ema8SeriesRef.current.setData(ema8Data)
      ema21SeriesRef.current.setData(ema21Data)
      vwapSeriesRef.current.setData(vwapData)
    } catch (error) {
      if (!isDisposedError(error)) {
        console.warn('[TradingChart] Failed to set indicator data', error)
      }
      return
    }

    if (rsiSeriesRef.current) {
      const rsiData = indicators.rsi ? buildRSIData() : []
      try {
        rsiSeriesRef.current.setData(rsiData)
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to set RSI data', error)
        }
      }
    }

    if (macdSeriesRef.current && macdSignalSeriesRef.current && macdHistogramSeriesRef.current) {
      if (indicators.macd) {
        const macdData = buildMACDData()
        try {
          macdSeriesRef.current.setData(macdData.macd)
          macdSignalSeriesRef.current.setData(macdData.signal)
          macdHistogramSeriesRef.current.setData(macdData.histogram)
        } catch (error) {
          if (!isDisposedError(error)) {
            console.warn('[TradingChart] Failed to set MACD data', error)
          }
        }
      } else {
        try {
          macdSeriesRef.current.setData([])
          macdSignalSeriesRef.current.setData([])
          macdHistogramSeriesRef.current.setData([])
        } catch (error) {
          if (!isDisposedError(error)) {
            console.warn('[TradingChart] Failed to clear MACD data', error)
          }
        }
      }
    }

    // Auto-fit only until the user manually pans/zooms the chart.
    if (!userAdjustedViewportRef.current) {
      chartRef.current?.timeScale().fitContent()
      chartRef.current?.timeScale().scrollToRealTime()
      rsiChartRef.current?.timeScale().fitContent()
      macdChartRef.current?.timeScale().fitContent()
    }
  }, [safeBars, indicators, buildRSIData, buildMACDData])

  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current || (!onHoverPrice && !onCrosshairSnapshot)) return

    const chart = chartRef.current
    const series = candlestickSeriesRef.current
    const volumeSeries = volumeSeriesRef.current
    const barByTime = new Map<number, ChartBar>(safeBars.map((bar) => [bar.time, bar]))

    const handleCrosshairMove = (param: any) => {
      if (!param?.point || !param?.time) {
        onHoverPrice?.(null)
        onCrosshairSnapshot?.(null)
        return
      }

      const seriesData = param.seriesData?.get(series)
      if (
        seriesData
        && typeof seriesData.open === 'number'
        && typeof seriesData.high === 'number'
        && typeof seriesData.low === 'number'
        && typeof seriesData.close === 'number'
      ) {
        const timeSec = toUnixSecondsFromChartTime(param.time)
        const volumeData = volumeSeries ? param.seriesData?.get(volumeSeries) : null
        const fallbackBar = timeSec != null ? barByTime.get(timeSec) : null
        const volume = volumeData && typeof volumeData.value === 'number'
          ? volumeData.value
          : (fallbackBar?.volume ?? null)
        onHoverPrice?.(seriesData.close)
        if (timeSec != null) {
          onCrosshairSnapshot?.({
            timeSec,
            open: seriesData.open,
            high: seriesData.high,
            low: seriesData.low,
            close: seriesData.close,
            volume,
          })
        } else {
          onCrosshairSnapshot?.(null)
        }
        return
      }

      if (typeof param.point.y === 'number') {
        const coordinatePrice = series.coordinateToPrice(param.point.y)
        if (typeof coordinatePrice === 'number' && Number.isFinite(coordinatePrice)) {
          onHoverPrice?.(coordinatePrice)
          onCrosshairSnapshot?.(null)
          return
        }
      }

      onHoverPrice?.(null)
      onCrosshairSnapshot?.(null)
    }

    chart.subscribeCrosshairMove(handleCrosshairMove)
    return () => {
      try {
        chart.unsubscribeCrosshairMove(handleCrosshairMove)
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to unsubscribe crosshair handler', error)
        }
      }
      onHoverPrice?.(null)
      onCrosshairSnapshot?.(null)
    }
  }, [onCrosshairSnapshot, onHoverPrice, safeBars])

  // Update level annotations
  useEffect(() => {
    if (!candlestickSeriesRef.current) return

    const series = candlestickSeriesRef.current

    clearLevelPriceLines(series)

    const derivedLevels: LevelAnnotation[] = [...levels]

    if (indicators.openingRange) {
      const openingRange = calculateOpeningRangeBox(safeBars, timeframe, openingRangeMinutes)
      if (openingRange) {
        derivedLevels.push({
          price: openingRange.high,
          label: 'OR High',
          color: CHART_COLORS.openingRange,
          lineWidth: 1,
          lineStyle: 'dotted',
          group: 'openingRange',
        })
        derivedLevels.push({
          price: openingRange.low,
          label: 'OR Low',
          color: CHART_COLORS.openingRange,
          lineWidth: 1,
          lineStyle: 'dotted',
          group: 'openingRange',
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
        group: 'position',
      })

      if (typeof position.stop === 'number') {
        derivedLevels.push({
          price: position.stop,
          label: `${label} Stop`,
          color: CHART_COLORS.stop,
          lineWidth: 1,
          lineStyle: 'dashed',
          group: 'position',
        })
      }

      if (typeof position.target === 'number') {
        derivedLevels.push({
          price: position.target,
          label: `${label} Target`,
          color: CHART_COLORS.target,
          lineWidth: 1,
          lineStyle: 'dashed',
          group: 'position',
        })
      }

      if (Array.isArray(position.targets) && position.targets.length > 0) {
        const targetLabelOffset = typeof position.target === 'number' ? 2 : 1
        for (const [index, target] of position.targets.entries()) {
          if (typeof target !== 'number' || !Number.isFinite(target)) continue
          derivedLevels.push({
            price: target,
            label: `${label} Target ${index + targetLabelOffset}`,
            color: CHART_COLORS.target,
            lineWidth: 1,
            lineStyle: 'dashed',
            group: 'position',
          })
        }
      }
    }

    const livePrice = safeBars.length > 0 ? safeBars[safeBars.length - 1]!.close : null
    const visibleLevelSelection = resolveVisibleChartLevels(derivedLevels, {
      livePrice,
      nearWindowPoints: resolvedLevelVisibilityBudget.nearWindowPoints,
      nearLabelBudget: resolvedLevelVisibilityBudget.nearLabelBudget,
      maxTotalLabels: resolvedLevelVisibilityBudget.maxTotalLabels,
      minGapPoints: resolvedLevelVisibilityBudget.minGapPoints,
    })
    const pixelCollisionGap = resolvedLevelVisibilityBudget.pixelCollisionGap
    const levelWithY = visibleLevelSelection.levels.map((level) => ({
      level,
      y: series.priceToCoordinate(level.price),
    }))
    const pixelFiltered: Array<{ level: LevelAnnotation; y: number | null }> = []
    let pixelCollisionSuppressedCount = 0
    for (const candidate of levelWithY) {
      const candidateY = candidate.y
      if (candidateY == null || !Number.isFinite(candidateY)) {
        pixelFiltered.push(candidate)
        continue
      }
      const collided = pixelFiltered.some((accepted) => (
        accepted.y != null
        && Number.isFinite(accepted.y)
        && Math.abs(accepted.y - candidateY) < pixelCollisionGap
      ))
      if (collided) {
        pixelCollisionSuppressedCount += 1
        continue
      }
      pixelFiltered.push(candidate)
    }
    const visibleLevels = pixelFiltered.map((entry) => entry.level)
    const alwaysVisiblePositionLevels = derivedLevels.filter((level) => level.group === 'position')
    const forcedPositionLevels = alwaysVisiblePositionLevels.filter((positionLevel) => {
      return !visibleLevels.some((visibleLevel) => (
        Math.abs(visibleLevel.price - positionLevel.price) < 0.0001
        && visibleLevel.label === positionLevel.label
      ))
    })
    const finalLevels = [...visibleLevels, ...forcedPositionLevels]
    onLevelLayoutStats?.({
      ...visibleLevelSelection.stats,
      collisionSuppressedCount: visibleLevelSelection.stats.collisionSuppressedCount + pixelCollisionSuppressedCount,
    })

    // Add new price lines for each selected level
    const newLines = []
    for (const level of finalLevels) {
      const lineStyle = level.lineStyle === 'dashed' ? 1 : level.lineStyle === 'dotted' ? 2 : 0

      try {
        const line = series.createPriceLine({
          price: level.price,
          color: level.color,
          lineWidth: (level.lineWidth || 1) as 1 | 2 | 3 | 4,
          lineStyle,
          axisLabelVisible: level.axisLabelVisible ?? true,
          title: level.axisLabelVisible === false ? '' : level.label,
        })
        newLines.push(line)
      } catch (error) {
        if (!isDisposedError(error)) {
          console.warn('[TradingChart] Failed to create price line', error)
        }
      }
    }

    levelPriceLinesRef.current = newLines
  }, [
    levels,
    indicators.openingRange,
    safeBars,
    timeframe,
    openingRangeMinutes,
    positionOverlays,
    clearLevelPriceLines,
    onLevelLayoutStats,
    resolvedLevelVisibilityBudget.maxTotalLabels,
    resolvedLevelVisibilityBudget.minGapPoints,
    resolvedLevelVisibilityBudget.nearLabelBudget,
    resolvedLevelVisibilityBudget.nearWindowPoints,
    resolvedLevelVisibilityBudget.pixelCollisionGap,
  ])

  const showRSIPane = indicators.rsi
  const showMACDPane = indicators.macd

  return (
    <div className="relative w-full h-full">
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1">
          <div ref={containerRef} className="h-full w-full" />
          {timelineMarkers.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-20">
              {timelineMarkers.map((marker, index) => (
                <div
                  key={`${marker.label}-${index}`}
                  className="absolute bottom-0 top-0"
                  style={{ left: `${marker.leftPct}%` }}
                  title={marker.source || marker.label}
                >
                  <div className={cn(
                    'absolute left-1/2 top-1 -translate-x-1/2 whitespace-nowrap rounded border px-1.5 py-0.5 text-[9px] font-medium',
                    marker.impact === 'high'
                      ? 'border-red-500/35 bg-red-500/15 text-red-200'
                      : marker.impact === 'medium'
                        ? 'border-amber-500/35 bg-amber-500/15 text-amber-200'
                        : marker.impact === 'low'
                          ? 'border-sky-500/35 bg-sky-500/15 text-sky-200'
                          : 'border-white/20 bg-black/40 text-white/70',
                  )}>
                    {marker.label}
                  </div>
                  <div className={cn(
                    'absolute left-1/2 top-6 bottom-0 -translate-x-1/2 border-l border-dashed',
                    marker.impact === 'high'
                      ? 'border-red-500/45'
                      : marker.impact === 'medium'
                        ? 'border-amber-500/45'
                        : marker.impact === 'low'
                          ? 'border-sky-500/45'
                          : 'border-white/25',
                  )} />
                </div>
              ))}
            </div>
          )}
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
