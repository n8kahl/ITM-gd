'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, RotateCcw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TradeReplayData } from '@/lib/types/journal'

// ============================================
// TYPES
// ============================================

type ReplaySpeed = 1 | 2 | 5 | 10

interface TradeReplayChartProps {
  entryId: string
  symbol: string
  tradeDate: string
}

// ============================================
// COMPONENT
// ============================================

export function TradeReplayChart({ entryId, symbol, tradeDate }: TradeReplayChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const candleSeriesRef = useRef<any>(null)
  const vwapSeriesRef = useRef<any>(null)

  const [replayData, setReplayData] = useState<TradeReplayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<ReplaySpeed>(1)
  const [currentBarIndex, setCurrentBarIndex] = useState(0)
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch replay data
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
    fetchReplay()
    return () => { cancelled = true }
  }, [entryId])

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || !replayData || replayData.bars.length === 0) return

    let chart: any = null

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

      // Candlestick series
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10B981',
        downColor: '#EF4444',
        borderUpColor: '#10B981',
        borderDownColor: '#EF4444',
        wickUpColor: '#10B981',
        wickDownColor: '#EF4444',
      })
      candleSeriesRef.current = candleSeries

      // VWAP line
      if (replayData.vwapLine.length > 0) {
        const vwapSeries = chart.addSeries(LineSeries, {
          color: '#3B82F6',
          lineWidth: 1,
          lineStyle: 2, // dashed
          priceLineVisible: false,
        })
        vwapSeries.setData(replayData.vwapLine.map(v => ({
          time: v.time as any,
          value: v.value,
        })))
        vwapSeriesRef.current = vwapSeries
      }

      // Set initial bar data (show first bar)
      candleSeries.setData([{
        time: replayData.bars[0].time as any,
        open: replayData.bars[0].open,
        high: replayData.bars[0].high,
        low: replayData.bars[0].low,
        close: replayData.bars[0].close,
      }])

      // Add price lines for levels
      if (replayData.levels) {
        const levels = [
          { price: replayData.levels.pdh, title: 'PDH', color: '#F59E0B' },
          { price: replayData.levels.pdl, title: 'PDL', color: '#F59E0B' },
          { price: replayData.levels.pivotPP, title: 'PP', color: '#F3E5AB' },
        ]

        levels.forEach(level => {
          if (level.price > 0) {
            candleSeries.createPriceLine({
              price: level.price,
              color: level.color,
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: level.title,
            })
          }
        })
      }

      setCurrentBarIndex(0)

      // Handle resize
      const observer = new ResizeObserver(() => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth })
        }
      })
      observer.observe(chartContainerRef.current)

      return () => {
        observer.disconnect()
        chart.remove()
      }
    }

    const cleanup = initChart()
    return () => {
      cleanup?.then(fn => fn?.())
      if (chartRef.current) {
        try { chartRef.current.remove() } catch {}
        chartRef.current = null
      }
    }
  }, [replayData])

  // Playback loop
  useEffect(() => {
    if (!playing || !replayData || !candleSeriesRef.current) return

    const interval = 1000 / speed
    playIntervalRef.current = setInterval(() => {
      setCurrentBarIndex(prev => {
        const next = prev + 1
        if (next >= replayData.bars.length) {
          setPlaying(false)
          return prev
        }

        // Add the next bar
        const bar = replayData.bars[next]
        candleSeriesRef.current.update({
          time: bar.time as any,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        })

        // Add entry/exit markers
        if (replayData.entryPoint && bar.time >= replayData.entryPoint.time && (next === 0 || replayData.bars[next - 1].time < replayData.entryPoint.time)) {
          candleSeriesRef.current.setMarkers([{
            time: bar.time as any,
            position: 'belowBar',
            color: '#10B981',
            shape: 'arrowUp',
            text: 'Entry',
          }])
        }

        if (replayData.exitPoint && bar.time >= replayData.exitPoint.time && (next === 0 || replayData.bars[next - 1].time < replayData.exitPoint.time)) {
          const markers = candleSeriesRef.current.markers?.() || []
          candleSeriesRef.current.setMarkers([
            ...markers,
            {
              time: bar.time as any,
              position: 'aboveBar',
              color: '#EF4444',
              shape: 'arrowDown',
              text: 'Exit',
            },
          ])
        }

        return next
      })
    }, interval)

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current)
    }
  }, [playing, speed, replayData])

  // Reset
  const handleReset = useCallback(() => {
    setPlaying(false)
    setCurrentBarIndex(0)
    if (candleSeriesRef.current && replayData && replayData.bars.length > 0) {
      candleSeriesRef.current.setData([{
        time: replayData.bars[0].time as any,
        open: replayData.bars[0].open,
        high: replayData.bars[0].high,
        low: replayData.bars[0].low,
        close: replayData.bars[0].close,
      }])
      candleSeriesRef.current.setMarkers([])
    }
  }, [replayData])

  // Scrubber
  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!replayData || !candleSeriesRef.current) return
    const idx = parseInt(e.target.value)
    setPlaying(false)
    setCurrentBarIndex(idx)

    // Rebuild chart up to this index
    const visibleBars = replayData.bars.slice(0, idx + 1).map(b => ({
      time: b.time as any,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }))
    candleSeriesRef.current.setData(visibleBars)

    // Add markers if entry/exit are visible
    const markers: any[] = []
    if (replayData.entryPoint) {
      const entryBar = replayData.bars.findIndex(b => b.time >= replayData.entryPoint.time)
      if (entryBar >= 0 && entryBar <= idx) {
        markers.push({
          time: replayData.bars[entryBar].time as any,
          position: 'belowBar',
          color: '#10B981',
          shape: 'arrowUp',
          text: 'Entry',
        })
      }
    }
    if (replayData.exitPoint) {
      const exitBar = replayData.bars.findIndex(b => b.time >= replayData.exitPoint.time)
      if (exitBar >= 0 && exitBar <= idx) {
        markers.push({
          time: replayData.bars[exitBar].time as any,
          position: 'aboveBar',
          color: '#EF4444',
          shape: 'arrowDown',
          text: 'Exit',
        })
      }
    }
    candleSeriesRef.current.setMarkers(markers)
  }, [replayData])

  // Current time display
  const currentTime = replayData && currentBarIndex < replayData.bars.length
    ? new Date(replayData.bars[currentBarIndex].time * 1000).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York',
      })
    : ''

  return (
    <div className="glass-card-heavy rounded-xl overflow-hidden">
      {/* Chart Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trade Replay</h4>
        {currentTime && (
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{currentTime} ET</span>
        )}
      </div>

      {/* Chart Container */}
      <div className="px-2">
        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-xs text-muted-foreground">Loading market data...</span>
          </div>
        ) : error ? (
          <div className="h-[300px] flex items-center justify-center text-xs text-muted-foreground">
            {error}
          </div>
        ) : (
          <div ref={chartContainerRef} className="h-[300px]" />
        )}
      </div>

      {/* Controls */}
      {replayData && replayData.bars.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.04] space-y-2">
          {/* Transport + Speed */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPlaying(!playing)}
              className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={handleReset}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground hover:text-ivory transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Speed selector */}
            <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 ml-2">
              {([1, 2, 5, 10] as ReplaySpeed[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={cn(
                    'px-2 py-1 rounded-md text-[10px] font-medium transition-colors',
                    speed === s ? 'bg-emerald-900/30 text-emerald-400' : 'text-muted-foreground hover:text-ivory'
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Progress */}
            <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">
              {currentBarIndex + 1} / {replayData.bars.length}
            </span>
          </div>

          {/* Scrubber */}
          <input
            type="range"
            min={0}
            max={replayData.bars.length - 1}
            value={currentBarIndex}
            onChange={handleScrub}
            className="w-full h-1 rounded-full appearance-none bg-white/[0.06] accent-emerald-500 cursor-pointer"
          />
        </div>
      )}
    </div>
  )
}
