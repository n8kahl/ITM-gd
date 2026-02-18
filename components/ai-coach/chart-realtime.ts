import type { ChartBar, ChartTimeframe } from '@/lib/api/ai-coach'

const TIMEFRAME_SECONDS: Record<ChartTimeframe, number> = {
  '1m': 60,
  '5m': 5 * 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
  '4h': 4 * 60 * 60,
  '1D': 24 * 60 * 60,
}

function toUnixSeconds(value: string): number {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.floor(Date.now() / 1000)
  }
  return Math.floor(parsed / 1000)
}

interface RealtimeMicrobarUpdate {
  bucketStartMs: number
  open: number
  high: number
  low: number
  close: number
}

export function bucketStartUnixSeconds(
  timestampSeconds: number,
  timeframe: ChartTimeframe,
): number {
  const bucketSize = TIMEFRAME_SECONDS[timeframe]
  return Math.floor(timestampSeconds / bucketSize) * bucketSize
}

export function mergeRealtimePriceIntoBars(
  bars: ChartBar[],
  timeframe: ChartTimeframe,
  price: number,
  timestampIso: string,
): { bars: ChartBar[]; changed: boolean } {
  if (!Number.isFinite(price) || price <= 0 || bars.length === 0) {
    return { bars, changed: false }
  }

  const nextTimestamp = toUnixSeconds(timestampIso)
  const lastBar = bars[bars.length - 1]
  const updateLastBar = (bar: ChartBar): { bars: ChartBar[]; changed: boolean } => {
    const high = Math.max(bar.high, price)
    const low = Math.min(bar.low, price)
    const close = price

    if (high === bar.high && low === bar.low && close === bar.close) {
      return { bars, changed: false }
    }

    const nextBars = [...bars]
    nextBars[nextBars.length - 1] = {
      ...bar,
      high,
      low,
      close,
    }
    return { bars: nextBars, changed: true }
  }

  if (timeframe === '1D') {
    return updateLastBar(lastBar)
  }

  const bucketStart = bucketStartUnixSeconds(nextTimestamp, timeframe)
  if (bucketStart < lastBar.time) {
    // Handle out-of-order packets that still map to an existing visible candle.
    // This keeps the chart aligned when realtime ticks arrive slightly late.
    for (let i = bars.length - 1; i >= 0 && i >= bars.length - 4; i -= 1) {
      const candidate = bars[i]
      if (candidate.time !== bucketStart) continue
      const high = Math.max(candidate.high, price)
      const low = Math.min(candidate.low, price)
      const close = price
      if (high === candidate.high && low === candidate.low && close === candidate.close) {
        return { bars, changed: false }
      }

      const nextBars = [...bars]
      nextBars[i] = {
        ...candidate,
        high,
        low,
        close,
      }
      return { bars: nextBars, changed: true }
    }

    return { bars, changed: false }
  }

  if (bucketStart === lastBar.time) {
    return updateLastBar(lastBar)
  }

  const open = lastBar.close
  const nextBar: ChartBar = {
    time: bucketStart,
    open,
    high: Math.max(open, price),
    low: Math.min(open, price),
    close: price,
    volume: 0,
  }

  return {
    bars: [...bars, nextBar],
    changed: true,
  }
}

export function mergeRealtimeMicrobarIntoBars(
  bars: ChartBar[],
  timeframe: ChartTimeframe,
  microbar: RealtimeMicrobarUpdate,
): { bars: ChartBar[]; changed: boolean } {
  if (timeframe !== '1m') return { bars, changed: false }
  if (bars.length === 0) return { bars, changed: false }
  if (!Number.isFinite(microbar.close) || microbar.close <= 0) return { bars, changed: false }
  if (!Number.isFinite(microbar.bucketStartMs) || microbar.bucketStartMs <= 0) return { bars, changed: false }

  const bucketStart = bucketStartUnixSeconds(Math.floor(microbar.bucketStartMs / 1000), timeframe)
  const lastBar = bars[bars.length - 1]
  const high = Number.isFinite(microbar.high) ? microbar.high : microbar.close
  const low = Number.isFinite(microbar.low) ? microbar.low : microbar.close

  const applyUpdate = (index: number): { bars: ChartBar[]; changed: boolean } => {
    const candidate = bars[index]
    const nextHigh = Math.max(candidate.high, high, microbar.close)
    const nextLow = Math.min(candidate.low, low, microbar.close)
    const nextClose = microbar.close

    if (nextHigh === candidate.high && nextLow === candidate.low && nextClose === candidate.close) {
      return { bars, changed: false }
    }

    const nextBars = [...bars]
    nextBars[index] = {
      ...candidate,
      high: nextHigh,
      low: nextLow,
      close: nextClose,
    }
    return { bars: nextBars, changed: true }
  }

  if (bucketStart === lastBar.time) {
    return applyUpdate(bars.length - 1)
  }

  if (bucketStart < lastBar.time) {
    for (let i = bars.length - 1; i >= 0 && i >= bars.length - 8; i -= 1) {
      if (bars[i].time === bucketStart) {
        return applyUpdate(i)
      }
    }
    return { bars, changed: false }
  }

  const open = lastBar.close > 0 ? lastBar.close : (Number.isFinite(microbar.open) && microbar.open > 0 ? microbar.open : microbar.close)
  const nextBar: ChartBar = {
    time: bucketStart,
    open,
    high: Math.max(open, high, microbar.close),
    low: Math.min(open, low, microbar.close),
    close: microbar.close,
    volume: 0,
  }

  return {
    bars: [...bars, nextBar],
    changed: true,
  }
}
