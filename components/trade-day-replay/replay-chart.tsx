'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { TradingChart } from '@/components/ai-coach/trading-chart'
import {
  createSPXReplayEngine,
  getSPXReplayIntervalMs,
  type SPXReplayEngine,
  type SPXReplaySpeed,
} from '@/lib/spx/replay-engine'
import type { ChartBar, EnrichedTrade } from '@/lib/trade-day-replay/types'
import { ReplayControls } from './replay-controls'
import { TradeMarkerOverlay } from './trade-marker-overlay'

interface ReplayChartProps {
  bars: ChartBar[]
  trades: EnrichedTrade[]
}

interface ReplayChartPanelProps {
  replayEngine: SPXReplayEngine
  trades: EnrichedTrade[]
}

const REPLAY_INDICATORS = {
  ema8: false,
  ema21: false,
  vwap: false,
  openingRange: false,
  rsi: false,
  macd: false,
}

function parseEpochSeconds(value: string | null | undefined): number | null {
  if (!value) return null
  const epochMs = Date.parse(value)
  if (!Number.isFinite(epochMs)) return null
  return Math.floor(epochMs / 1000)
}

function findNearestBarIndex(bars: ChartBar[], targetTimeSec: number): number | null {
  if (bars.length === 0) return null

  let left = 0
  let right = bars.length - 1

  while (left < right) {
    const mid = Math.floor((left + right) / 2)
    if (bars[mid]!.time < targetTimeSec) {
      left = mid + 1
    } else {
      right = mid
    }
  }

  const candidate = left
  const previous = Math.max(candidate - 1, 0)
  const candidateDistance = Math.abs(bars[candidate]!.time - targetTimeSec)
  const previousDistance = Math.abs(bars[previous]!.time - targetTimeSec)
  return previousDistance <= candidateDistance ? previous : candidate
}

function ReplayChartPanel({ replayEngine, trades }: ReplayChartPanelProps) {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<SPXReplaySpeed>(1)
  const [cursorIndex, setCursorIndex] = useState<number>(replayEngine.firstCursorIndex)
  const [selectedTradeIndex, setSelectedTradeIndex] = useState<number | null>(null)

  const clampCursorIndex = useCallback((nextCursorIndex: number): number => (
    Math.min(
      Math.max(nextCursorIndex, replayEngine.firstCursorIndex),
      replayEngine.lastCursorIndex,
    )
  ), [replayEngine.firstCursorIndex, replayEngine.lastCursorIndex])

  useEffect(() => {
    if (!playing || replayEngine.bars.length === 0) return

    const intervalMs = getSPXReplayIntervalMs(speed)
    const intervalId = window.setInterval(() => {
      setCursorIndex((currentCursorIndex) => {
        if (replayEngine.isComplete(currentCursorIndex)) {
          setPlaying(false)
          return currentCursorIndex
        }
        return replayEngine.nextCursorIndex(currentCursorIndex)
      })
    }, intervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [playing, replayEngine, speed])

  const frame = useMemo(
    () => replayEngine.getFrame(cursorIndex),
    [cursorIndex, replayEngine],
  )
  const hasBars = replayEngine.bars.length > 0
  const visibleBars = frame.visibleBars

  const handleTogglePlay = useCallback(() => {
    if (!hasBars) return

    if (playing) {
      setPlaying(false)
      return
    }

    if (replayEngine.isComplete(cursorIndex)) {
      setCursorIndex(replayEngine.firstCursorIndex)
    }
    setPlaying(true)
  }, [cursorIndex, hasBars, playing, replayEngine])

  const handleCursorIndexChange = useCallback((nextCursorIndex: number) => {
    if (!Number.isFinite(nextCursorIndex)) return

    setPlaying(false)
    setCursorIndex(clampCursorIndex(Math.round(nextCursorIndex)))
  }, [clampCursorIndex])

  const handleJumpToTrade = useCallback((tradeIndex: number | null) => {
    setSelectedTradeIndex(tradeIndex)
    if (tradeIndex == null) return

    const trade = trades.find((candidate) => candidate.tradeIndex === tradeIndex)
    if (!trade || replayEngine.bars.length === 0) return

    const entryTimeSec = parseEpochSeconds(trade.entryTimestamp)
    if (entryTimeSec == null) return

    const nearestBarIndex = findNearestBarIndex(replayEngine.bars, entryTimeSec)
    if (nearestBarIndex == null) return

    setPlaying(false)
    setCursorIndex(clampCursorIndex(nearestBarIndex))
  }, [clampCursorIndex, replayEngine.bars, trades])

  return (
    <section className="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 lg:p-4">
      <ReplayControls
        playing={playing}
        speed={speed}
        cursorIndex={frame.cursorIndex}
        minCursorIndex={replayEngine.firstCursorIndex}
        maxCursorIndex={replayEngine.lastCursorIndex}
        progress={frame.progress}
        currentTimestampSec={frame.currentBar?.time ?? null}
        trades={trades}
        selectedTradeIndex={selectedTradeIndex}
        disabled={!hasBars}
        onTogglePlay={handleTogglePlay}
        onSpeedChange={setSpeed}
        onCursorIndexChange={handleCursorIndexChange}
        onJumpToTrade={handleJumpToTrade}
      />

      <div className="relative h-[440px] overflow-hidden rounded-lg border border-white/10 bg-[#0a0f0d]">
        {hasBars ? (
          <>
            <TradingChart
              bars={visibleBars}
              symbol="SPX"
              timeframe="1m"
              indicators={REPLAY_INDICATORS}
              futureOffsetBars={0}
            />
            <TradeMarkerOverlay visibleBars={visibleBars} trades={trades} />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/60">
            No chart bars available for replay.
          </div>
        )}
      </div>
    </section>
  )
}

export function ReplayChart({ bars, trades }: ReplayChartProps) {
  const replayEngine = useMemo(
    () => createSPXReplayEngine(bars, { windowMinutes: 60 }),
    [bars],
  )

  return (
    <ReplayChartPanel
      key={replayEngine.checksum}
      replayEngine={replayEngine}
      trades={trades}
    />
  )
}
