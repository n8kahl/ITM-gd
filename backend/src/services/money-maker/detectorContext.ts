import { CandleBar } from '../../lib/money-maker/types'
import { computeEMA } from '../../lib/money-maker/indicator-computer'
import { toEasternTime } from '../marketHours'

export interface DetectionTimeframeConfig {
  label: '2m' | '5m' | '10m'
  dataKey: '2Min' | '5Min' | '10Min'
  timeframeMs: number
}

export function resolveDetectionTimeframe(timestamp: number): DetectionTimeframeConfig {
  const et = toEasternTime(new Date(timestamp))
  const minutesFromMidnight = et.hour * 60 + et.minute

  if (minutesFromMidnight < 600) {
    return {
      label: '2m',
      dataKey: '2Min',
      timeframeMs: 2 * 60 * 1000,
    }
  }

  if (minutesFromMidnight < 690) {
    return {
      label: '5m',
      dataKey: '5Min',
      timeframeMs: 5 * 60 * 1000,
    }
  }

  return {
    label: '10m',
    dataKey: '10Min',
    timeframeMs: 10 * 60 * 1000,
  }
}

export function getCompletedBars<T extends { timestamp: number }>(
  bars: T[],
  timeframeMs: number,
  nowTs: number = Date.now(),
): T[] {
  if (bars.length === 0) {
    return []
  }

  return bars.filter((bar, index) => {
    if (index < bars.length - 1) {
      return true
    }

    return nowTs - bar.timestamp >= timeframeMs
  })
}

export function buildRunningVwapSeries(bars: CandleBar[]): number[] {
  let cumulativePV = 0
  let cumulativeV = 0

  return bars.map((bar) => {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3
    cumulativePV += typicalPrice * bar.volume
    cumulativeV += bar.volume
    return cumulativeV === 0 ? 0 : cumulativePV / cumulativeV
  })
}

export function detectVwapReclaimFromBelow(
  bars: CandleBar[],
  runningVwaps: number[],
  candidateIndex: number,
  direction: 'long' | 'short',
): boolean {
  if (direction !== 'long' || candidateIndex < 1) {
    return false
  }

  const previousBar = bars[candidateIndex - 1]
  const candidateBar = bars[candidateIndex]
  const previousVwap = runningVwaps[candidateIndex - 1]
  const candidateVwap = runningVwaps[candidateIndex]

  if (
    typeof previousVwap !== 'number'
    || typeof candidateVwap !== 'number'
    || previousVwap === 0
    || candidateVwap === 0
  ) {
    return false
  }

  return previousBar.close < previousVwap && candidateBar.close > candidateVwap
}

export function computePreviousDayTrend(
  previousDay: CandleBar | null,
  direction: 'long' | 'short',
): boolean {
  if (!previousDay) {
    return false
  }

  const range = previousDay.high - previousDay.low
  if (range <= 0) {
    return false
  }

  const bodyRatio = Math.abs(previousDay.close - previousDay.open) / range
  if (bodyRatio < 0.5) {
    return false
  }

  return direction === 'long'
    ? previousDay.close > previousDay.open
    : previousDay.close < previousDay.open
}

export function passesHourlyTrendFilter(
  hourlyBars: CandleBar[],
  currentPrice: number,
  direction: 'long' | 'short',
): boolean {
  if (hourlyBars.length < 21) {
    return false
  }

  const hourlyEma21 = computeEMA(hourlyBars, 21)
  return direction === 'long' ? currentPrice > hourlyEma21 : currentPrice < hourlyEma21
}

export function computeSteepTrend(
  bars: CandleBar[],
  candidateIndex: number,
  direction: 'long' | 'short',
): boolean {
  const window = bars.slice(Math.max(0, candidateIndex - 6), candidateIndex)
  if (window.length < 4) {
    return false
  }

  const firstOpen = window[0].open
  const lastClose = window[window.length - 1].close
  if (firstOpen === 0) {
    return false
  }

  const movePct = ((lastClose - firstOpen) / firstOpen) * 100
  const directionalCloses = window.slice(1).reduce((count, bar, index) => {
    const previous = window[index]
    const isDirectional = direction === 'long'
      ? bar.close >= previous.close
      : bar.close <= previous.close
    return count + (isDirectional ? 1 : 0)
  }, 0)

  const directionalBodies = window.reduce((count, bar) => {
    const isDirectional = direction === 'long'
      ? bar.close >= bar.open
      : bar.close <= bar.open
    return count + (isDirectional ? 1 : 0)
  }, 0)

  const closeThreshold = Math.max(2, window.length - 2)
  const bodyThreshold = Math.ceil(window.length * 0.6)

  return direction === 'long'
    ? movePct >= 0.6 && directionalCloses >= closeThreshold && directionalBodies >= bodyThreshold
    : movePct <= -0.6 && directionalCloses >= closeThreshold && directionalBodies >= bodyThreshold
}

export function computeTrendStrength(
  bars: CandleBar[],
  candidateIndex: number,
  direction: 'long' | 'short',
): number {
  const window = bars.slice(Math.max(0, candidateIndex - 6), candidateIndex)
  if (window.length < 2) {
    return 0
  }

  const firstOpen = window[0].open
  const lastClose = window[window.length - 1].close
  const movePct = firstOpen === 0 ? 0 : ((lastClose - firstOpen) / firstOpen) * 100

  const directionalCloses = window.slice(1).reduce((count, bar, index) => {
    const previous = window[index]
    const isDirectional = direction === 'long'
      ? bar.close >= previous.close
      : bar.close <= previous.close
    return count + (isDirectional ? 1 : 0)
  }, 0)

  const closeRatio = window.length > 1 ? directionalCloses / (window.length - 1) : 0
  const directionalScore = closeRatio * 60
  const momentumScore = Math.min(40, Math.abs(movePct) * 20)

  return Math.max(0, Math.min(100, Math.round(directionalScore + momentumScore)))
}

export function computeMorningTrend(
  sessionBars5m: CandleBar[],
  direction: 'long' | 'short',
): boolean {
  const morningBars = sessionBars5m.filter((bar) => {
    const et = toEasternTime(new Date(bar.timestamp))
    return et.hour < 13
  })

  if (morningBars.length < 6) {
    return false
  }

  const firstOpen = morningBars[0].open
  const lastClose = morningBars[morningBars.length - 1].close
  if (firstOpen === 0) {
    return false
  }

  const movePct = ((lastClose - firstOpen) / firstOpen) * 100
  const directionalBodies = morningBars.reduce((count, bar) => {
    const isDirectional = direction === 'long'
      ? bar.close >= bar.open
      : bar.close <= bar.open
    return count + (isDirectional ? 1 : 0)
  }, 0)

  const ratio = directionalBodies / morningBars.length

  return direction === 'long'
    ? movePct >= 1.0 && ratio >= 0.6
    : movePct <= -1.0 && ratio >= 0.6
}
