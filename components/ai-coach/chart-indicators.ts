import type { ChartBar } from '@/lib/api/ai-coach'

export interface IndicatorConfig {
  ema8: boolean
  ema21: boolean
  vwap: boolean
  openingRange: boolean
  rsi: boolean
  macd: boolean
}

export const DEFAULT_INDICATOR_CONFIG: IndicatorConfig = {
  ema8: true,
  ema21: true,
  vwap: true,
  openingRange: true,
  rsi: false,
  macd: false,
}

export interface IndicatorPoint {
  time: number
  value: number
}

export interface OpeningRangeBox {
  high: number
  low: number
  startTime: number
  endTime: number
}

function sanitizeBars(bars: ChartBar[]): ChartBar[] {
  return bars.filter((bar) => (
    Number.isFinite(bar.time)
    && Number.isFinite(bar.open)
    && Number.isFinite(bar.high)
    && Number.isFinite(bar.low)
    && Number.isFinite(bar.close)
  ))
}

export function calculateEMA(bars: ChartBar[], period: number): IndicatorPoint[] {
  const safeBars = sanitizeBars(bars)
  if (safeBars.length === 0 || period <= 1) {
    return safeBars.map((bar) => ({ time: bar.time, value: bar.close }))
  }

  const multiplier = 2 / (period + 1)
  const series: IndicatorPoint[] = []
  let ema = safeBars[0].close

  for (let i = 0; i < safeBars.length; i += 1) {
    const close = safeBars[i].close
    ema = i === 0 ? close : (close - ema) * multiplier + ema
    series.push({ time: safeBars[i].time, value: ema })
  }

  return series
}

export function calculateVWAPSeries(bars: ChartBar[]): IndicatorPoint[] {
  const safeBars = sanitizeBars(bars)
  if (safeBars.length === 0) return []

  let cumulativePv = 0
  let cumulativeVolume = 0

  return safeBars.map((bar) => {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3
    const volume = Number.isFinite(bar.volume) ? Math.max(bar.volume, 0) : 0

    cumulativePv += typicalPrice * volume
    cumulativeVolume += volume

    const vwap = cumulativeVolume > 0 ? cumulativePv / cumulativeVolume : bar.close
    return {
      time: bar.time,
      value: vwap,
    }
  })
}

export function calculateOpeningRangeBox(
  bars: ChartBar[],
  timeframe: string,
  openingMinutes: number = 15,
): OpeningRangeBox | null {
  const safeBars = sanitizeBars(bars)
  if (safeBars.length < 2) return null

  // Opening range only makes sense for intraday timeframes.
  if (timeframe === '1D') return null

  const firstTime = safeBars[0].time
  const sessionStart = firstTime - (firstTime % 86400)
  const openCutoff = sessionStart + openingMinutes * 60

  const windowBars = safeBars.filter((bar) => bar.time <= openCutoff)
  if (windowBars.length === 0) return null

  let high = windowBars[0].high
  let low = windowBars[0].low

  for (const bar of windowBars) {
    high = Math.max(high, bar.high)
    low = Math.min(low, bar.low)
  }

  return {
    high,
    low,
    startTime: windowBars[0].time,
    endTime: windowBars[windowBars.length - 1].time,
  }
}

export function calculateRSISeries(bars: ChartBar[], period: number = 14): IndicatorPoint[] {
  const safeBars = sanitizeBars(bars)
  if (safeBars.length <= period) return []

  const gains: number[] = []
  const losses: number[] = []
  for (let i = 1; i < safeBars.length; i += 1) {
    const delta = safeBars[i].close - safeBars[i - 1].close
    gains.push(Math.max(delta, 0))
    losses.push(Math.max(-delta, 0))
  }

  const series: IndicatorPoint[] = []
  let avgGain = gains.slice(0, period).reduce((sum, value) => sum + value, 0) / period
  let avgLoss = losses.slice(0, period).reduce((sum, value) => sum + value, 0) / period

  for (let i = period; i < gains.length; i += 1) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    const rsi = 100 - (100 / (1 + rs))

    series.push({
      time: safeBars[i + 1].time,
      value: rsi,
    })
  }

  return series
}

export function calculateMACDSeries(bars: ChartBar[]): {
  macd: IndicatorPoint[]
  signal: IndicatorPoint[]
} {
  const ema12 = calculateEMA(bars, 12)
  const ema26 = calculateEMA(bars, 26)

  if (ema12.length === 0 || ema26.length === 0) {
    return { macd: [], signal: [] }
  }

  const macd = ema12.map((point, index) => ({
    time: point.time,
    value: point.value - (ema26[index]?.value ?? point.value),
  }))

  const signal = calculateEMA(
    macd.map((point) => ({
      time: point.time,
      open: point.value,
      high: point.value,
      low: point.value,
      close: point.value,
      volume: 0,
    })),
    9,
  )

  return { macd, signal }
}
