'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Play, Pause, RotateCcw, Loader2, SkipForward, SkipBack } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TradeReplayData } from '@/lib/types/journal'

type ReplaySpeed = 1 | 2 | 5 | 10

interface TradeReplayChartProps {
  entryId: string
  symbol: string
  tradeDate: string
}

type ChartMarker = {
  time: any
  position: 'aboveBar' | 'belowBar'
  color: string
  shape: 'arrowUp' | 'arrowDown' | 'circle'
  text: string
}

function findIndexAtOrAfterTime(replayData: TradeReplayData | null, targetTime: number | null | undefined): number {
  if (!replayData?.bars?.length || !targetTime) return -1
  return replayData.bars.findIndex((bar) => bar.time >= targetTime)
}

function computeExtremaIndices(replayData: TradeReplayData | null, startIndex: number, endIndex: number): {
  mfeIndex: number | null
  maeIndex: number | null
} {
  if (!replayData || startIndex < 0 || endIndex < startIndex || !replayData.bars[startIndex]) {
    return { mfeIndex: null, maeIndex: null }
  }

  const direction = replayData.direction === 'short' ? 'short' : 'long'
  let highestIndex = startIndex
  let lowestIndex = startIndex

  for (let i = startIndex; i <= endIndex; i += 1) {
    if (!replayData.bars[i]) continue
    if (replayData.bars[i].high > replayData.bars[highestIndex].high) {
      highestIndex = i
    }
    if (replayData.bars[i].low < replayData.bars[lowestIndex].low) {
      lowestIndex = i
    }
  }

  return direction === 'short'
    ? { mfeIndex: lowestIndex, maeIndex: highestIndex }
    : { mfeIndex: highestIndex, maeIndex: lowestIndex }
}

export function TradeReplayChart({ entryId, symbol, tradeDate }: TradeReplayChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const candleSeriesRef = useRef<any>(null)
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [replayData, setReplayData] = useState<TradeReplayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<ReplaySpeed>(1)
  const [currentBarIndex, setCurrentBarIndex] = useState(0)

  const entryIndex = useMemo(
    () => findIndexAtOrAfterTime(replayData, replayData?.entryPoint?.time),
    [replayData],
  )
  const exitIndexRaw = useMemo(
    () => findIndexAtOrAfterTime(replayData, replayData?.exitPoint?.time),
    [replayData],
  )

  const replayEndIndex = useMemo(() => {
    if (!replayData?.bars.length) return 0
    if (exitIndexRaw >= 0) return exitIndexRaw
    return replayData.bars.length - 1
  }, [exitIndexRaw, replayData])

  const { mfeIndex, maeIndex } = useMemo(
    () => computeExtremaIndices(replayData, Math.max(entryIndex, 0), replayEndIndex),
    [entryIndex, replayData, replayEndIndex],
  )

  const buildMarkers = useCallback((upToIndex: number): ChartMarker[] => {
    if (!replayData?.bars.length) return []

    const markers: ChartMarker[] = []
    const direction = replayData.direction === 'short' ? 'short' : 'long'

    if (entryIndex >= 0 && entryIndex <= upToIndex) {
      markers.push({
        time: replayData.bars[entryIndex].time as any,
        position: direction === 'short' ? 'aboveBar' : 'belowBar',
        color: '#10B981',
        shape: direction === 'short' ? 'arrowDown' : 'arrowUp',
        text: 'Entry',
      })
    }

    if (exitIndexRaw >= 0 && exitIndexRaw <= upToIndex) {
      markers.push({
        time: replayData.bars[exitIndexRaw].time as any,
        position: direction === 'short' ? 'belowBar' : 'aboveBar',
        color: '#F59E0B',
        shape: direction === 'short' ? 'arrowUp' : 'arrowDown',
        text: 'Exit',
      })
    }

    if (mfeIndex != null && mfeIndex <= upToIndex) {
      markers.push({
        time: replayData.bars[mfeIndex].time as any,
        position: direction === 'short' ? 'belowBar' : 'aboveBar',
        color: '#10B981',
        shape: 'circle',
        text: 'MFE',
      })
    }

    if (maeIndex != null && maeIndex <= upToIndex) {
      markers.push({
        time: replayData.bars[maeIndex].time as any,
        position: direction === 'short' ? 'aboveBar' : 'belowBar',
        color: '#EF4444',
        shape: 'circle',
        text: 'MAE',
      })
    }

    return markers
  }, [entryIndex, exitIndexRaw, maeIndex, mfeIndex, replayData])

  const renderToIndex = useCallback((targetIndex: number) => {
    if (!replayData || !candleSeriesRef.current) return
    const clamped = Math.max(0, Math.min(targetIndex, replayEndIndex))

    const visibleBars = replayData.bars.slice(0, clamped + 1).map((bar) => ({
      time: bar.time as any,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }))

    candleSeriesRef.current.setData(visibleBars)
    candleSeriesRef.current.setMarkers(buildMarkers(clamped))
    setCurrentBarIndex(clamped)
  }, [buildMarkers, replayData, replayEndIndex])

  useEffect(() => {
    let cancelled = false
    async function fetchReplay() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/members/journal/replay/${entryId}`)
        if (!res.ok) throw new Error('Failed to load replay data')
        const data = await res.json()
        if (!cancelled && data.success) {
          setReplayData(data.data)
        } else if (!cancelled && !data.success) {
          setError(data.error?.message || 'Historical data unavailable for this date')
        }
      } catch {
        if (!cancelled) setError('Historical data unavailable for this date')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchReplay()
    return () => { cancelled = true }
  }, [entryId])

  useEffect(() => {
    if (!chartContainerRef.current || !replayData || replayData.bars.length === 0) return

    let chart: any = null
    let resizeObserver: ResizeObserver | null = null

    async function initChart() {
      const { createChart, CandlestickSeries, LineSeries } = await import('lightweight-charts')

      if (!chartContainerRef.current || !replayData || replayData.bars.length === 0) return

      chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 300,
        layout: {
          background: { color: 'transparent' },
          textColor: '#9A9A9A',
          fontSize: 10,
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.03)' },
          horzLines: { color: 'rgba(255,255,255,0.03)' },
        },
        crosshair: {
          vertLine: { color: 'rgba(255,255,255,0.1)', width: 1 },
          horzLine: { color: 'rgba(255,255,255,0.1)', width: 1 },
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.06)',
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.06)',
        },
      })

      chartRef.current = chart

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10B981',
        downColor: '#EF4444',
        borderUpColor: '#10B981',
        borderDownColor: '#EF4444',
        wickUpColor: '#10B981',
        wickDownColor: '#EF4444',
      })
      candleSeriesRef.current = candleSeries

      if (replayData.vwapLine.length > 0) {
        const vwapSeries = chart.addSeries(LineSeries, {
          color: '#3B82F6',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
        })
        vwapSeries.setData(replayData.vwapLine.map((item) => ({
          time: item.time as any,
          value: item.value,
        })))
      }

      const levelLines = [
        { price: replayData.levels?.pdh, title: 'PDH', color: '#F59E0B' },
        { price: replayData.levels?.pdl, title: 'PDL', color: '#F59E0B' },
        { price: replayData.levels?.pivotPP, title: 'PP', color: '#F3E5AB' },
        { price: replayData.stopLoss, title: 'SL', color: '#EF4444' },
        { price: replayData.initialTarget, title: 'TG', color: '#10B981' },
      ]

      levelLines.forEach((line) => {
        if (!line.price || line.price <= 0) return
        candleSeries.createPriceLine({
          price: line.price,
          color: line.color,
          lineWidth: line.title === 'SL' || line.title === 'TG' ? 2 : 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: line.title,
        })
      })

      candleSeries.setData([{
        time: replayData.bars[0].time as any,
        open: replayData.bars[0].open,
        high: replayData.bars[0].high,
        low: replayData.bars[0].low,
        close: replayData.bars[0].close,
      }])
      candleSeries.setMarkers(buildMarkers(0))
      setCurrentBarIndex(0)

      resizeObserver = new ResizeObserver(() => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth })
        }
      })
      resizeObserver.observe(chartContainerRef.current)
    }

    void initChart()

    return () => {
      if (resizeObserver) resizeObserver.disconnect()
      if (chartRef.current) {
        try { chartRef.current.remove() } catch {}
        chartRef.current = null
      }
      candleSeriesRef.current = null
    }
  }, [buildMarkers, replayData])

  useEffect(() => {
    if (!playing || !replayData || !candleSeriesRef.current) return

    const interval = Math.max(80, Math.floor(1000 / speed))
    playIntervalRef.current = setInterval(() => {
      setCurrentBarIndex((prev) => {
        const next = prev + 1
        if (next > replayEndIndex) {
          setPlaying(false)
          return prev
        }

        const bar = replayData.bars[next]
        if (!bar) {
          setPlaying(false)
          return prev
        }

        candleSeriesRef.current.update({
          time: bar.time as any,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        })
        candleSeriesRef.current.setMarkers(buildMarkers(next))
        return next
      })
    }, interval)

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current)
    }
  }, [buildMarkers, playing, replayData, replayEndIndex, speed])

  const handleReset = useCallback(() => {
    setPlaying(false)
    renderToIndex(0)
  }, [renderToIndex])

  const handleScrub = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPlaying(false)
    renderToIndex(Number.parseInt(event.target.value, 10))
  }, [renderToIndex])

  const handleSkipToEntry = useCallback(() => {
    if (entryIndex < 0) return
    setPlaying(false)
    renderToIndex(entryIndex)
  }, [entryIndex, renderToIndex])

  const handleSkipToExit = useCallback(() => {
    if (exitIndexRaw < 0) return
    setPlaying(false)
    renderToIndex(exitIndexRaw)
  }, [exitIndexRaw, renderToIndex])

  const currentBar = replayData?.bars[currentBarIndex] || null
  const currentTime = currentBar
    ? new Date(currentBar.time * 1000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/New_York',
      })
    : ''

  const pnlPreview = useMemo(() => {
    if (!replayData || !currentBar || replayData.entryPoint.price <= 0) return null
    const direction = replayData.direction === 'short' ? 'short' : 'long'
    const raw = direction === 'short'
      ? replayData.entryPoint.price - currentBar.close
      : currentBar.close - replayData.entryPoint.price
    const pct = (raw / replayData.entryPoint.price) * 100
    return { raw, pct, direction }
  }, [currentBar, replayData])

  return (
    <div className="glass-card-heavy rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Trade Replay • {symbol}
          </h4>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{tradeDate.split('T')[0]}</p>
        </div>
        <div className="text-right">
          {currentTime && (
            <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{currentTime} ET</p>
          )}
          {pnlPreview && (
            <p className={cn(
              'font-mono text-[11px] tabular-nums',
              pnlPreview.raw > 0 ? 'text-emerald-400' : pnlPreview.raw < 0 ? 'text-red-400' : 'text-muted-foreground',
            )}>
              {pnlPreview.raw >= 0 ? '+' : '-'}${Math.abs(pnlPreview.raw).toFixed(2)} ({pnlPreview.pct >= 0 ? '+' : ''}{pnlPreview.pct.toFixed(2)}%)
            </p>
          )}
        </div>
      </div>

      <div className="px-2">
        {loading ? (
          <div className="flex h-[300px] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-xs text-muted-foreground">Loading market data...</span>
          </div>
        ) : error ? (
          <div className="flex h-[300px] items-center justify-center text-xs text-muted-foreground">
            {error}
          </div>
        ) : (
          <div ref={chartContainerRef} className="h-[300px]" />
        )}
      </div>

      {replayData && replayData.bars.length > 0 && (
        <div className="space-y-2 border-t border-white/[0.04] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPlaying((prev) => !prev)}
              className="rounded-lg bg-emerald-600 p-2 text-white transition-colors hover:bg-emerald-500"
              aria-label={playing ? 'Pause replay' : 'Play replay'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={handleReset}
              className="rounded-lg bg-white/[0.04] p-2 text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-ivory"
              aria-label="Reset replay"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={handleSkipToEntry}
              disabled={entryIndex < 0}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-ivory disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SkipBack className="h-3.5 w-3.5" />
              Entry
            </button>
            <button
              onClick={handleSkipToExit}
              disabled={exitIndexRaw < 0}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-ivory disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Exit
            </button>

            <div className="ml-1 flex items-center gap-1 rounded-lg bg-white/[0.03] p-0.5">
              {([1, 2, 5, 10] as ReplaySpeed[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                    speed === s ? 'bg-emerald-900/30 text-emerald-400' : 'text-muted-foreground hover:text-ivory',
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>

            <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
              {Math.min(currentBarIndex + 1, replayEndIndex + 1)} / {replayEndIndex + 1}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={replayEndIndex}
            value={Math.min(currentBarIndex, replayEndIndex)}
            onChange={handleScrub}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/[0.06] accent-emerald-500"
          />
        </div>
      )}
    </div>
  )
}

