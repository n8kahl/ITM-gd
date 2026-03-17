import {
  buildRunningVwapSeries,
  computeMorningTrend,
  computePreviousDayTrend,
  computeSteepTrend,
  computeTrendStrength,
  detectVwapReclaimFromBelow,
  getCompletedBars,
  passesHourlyTrendFilter,
  resolveDetectionTimeframe,
} from '../detectorContext'

function makeBar(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number = 1000,
) {
  return { timestamp, open, high, low, close, volume }
}

describe('detectorContext', () => {
  it('resolves the active detection timeframe by time of day', () => {
    expect(resolveDetectionTimeframe(new Date('2026-03-16T09:45:00-04:00').getTime())).toEqual({
      label: '2m',
      dataKey: '2Min',
      timeframeMs: 120000,
    })
    expect(resolveDetectionTimeframe(new Date('2026-03-16T10:15:00-04:00').getTime())).toEqual({
      label: '5m',
      dataKey: '5Min',
      timeframeMs: 300000,
    })
    expect(resolveDetectionTimeframe(new Date('2026-03-16T12:15:00-04:00').getTime())).toEqual({
      label: '10m',
      dataKey: '10Min',
      timeframeMs: 600000,
    })
  })

  it('filters out an in-progress final bar when selecting completed bars', () => {
    const bars = [
      makeBar(1_000, 100, 101, 99.5, 100.5),
      makeBar(1_300, 100.5, 101.2, 100.2, 101),
    ]

    expect(getCompletedBars(bars, 300_000, 1_000 + 60_000)).toEqual([bars[0]])
    expect(getCompletedBars(bars, 300_000, 1_300 + 300_000)).toEqual(bars)
  })

  it('detects an advanced VWAP reclaim from below', () => {
    const bars = [
      makeBar(1, 100.4, 100.6, 99.8, 100.0, 1000),
      makeBar(2, 99.9, 100.8, 99.7, 100.7, 1200),
    ]
    const vwaps = buildRunningVwapSeries(bars)

    expect(detectVwapReclaimFromBelow(bars, vwaps, 1, 'long')).toBe(true)
    expect(detectVwapReclaimFromBelow(bars, vwaps, 1, 'short')).toBe(false)
  })

  it('detects strong previous-day trend direction correctly', () => {
    const bullishDay = makeBar(1, 100, 110, 99, 108)
    const bearishDay = makeBar(1, 110, 111, 100, 101)
    const choppyDay = makeBar(1, 100, 104, 98, 101)

    expect(computePreviousDayTrend(bullishDay, 'long')).toBe(true)
    expect(computePreviousDayTrend(bearishDay, 'short')).toBe(true)
    expect(computePreviousDayTrend(choppyDay, 'long')).toBe(false)
  })

  it('applies the hourly 21 EMA trend filter', () => {
    const hourlyBars = Array.from({ length: 25 }, (_, index) => makeBar(index, 100 + index, 101 + index, 99 + index, 100.5 + index))

    expect(passesHourlyTrendFilter(hourlyBars, 130, 'long')).toBe(true)
    expect(passesHourlyTrendFilter(hourlyBars, 120, 'short')).toBe(false)
  })

  it('measures steep trend and trend strength from the lead-in bars', () => {
    const bullishBars = [
      makeBar(1, 100, 101, 99.9, 100.8),
      makeBar(2, 100.8, 101.6, 100.7, 101.4),
      makeBar(3, 101.4, 102.1, 101.2, 101.9),
      makeBar(4, 101.9, 102.8, 101.8, 102.5),
      makeBar(5, 102.5, 103.4, 102.4, 103.2),
      makeBar(6, 103.2, 103.5, 102.7, 103.0),
    ]

    expect(computeSteepTrend(bullishBars, 5, 'long')).toBe(true)
    expect(computeTrendStrength(bullishBars, 5, 'long')).toBeGreaterThanOrEqual(70)
  })

  it('detects a strong morning trend for cloud eligibility', () => {
    const sessionBars5m = Array.from({ length: 8 }, (_, index) => {
      const timestamp = new Date('2026-03-16T09:30:00-04:00').getTime() + index * 5 * 60 * 1000
      return makeBar(timestamp, 100 + index * 0.4, 100.7 + index * 0.4, 99.9 + index * 0.4, 100.6 + index * 0.4)
    })

    expect(computeMorningTrend(sessionBars5m, 'long')).toBe(true)
    expect(computeMorningTrend(sessionBars5m, 'short')).toBe(false)
  })
})
