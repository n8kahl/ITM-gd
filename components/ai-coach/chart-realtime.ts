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
