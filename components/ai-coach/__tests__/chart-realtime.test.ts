import { describe, expect, it, vi } from 'vitest'
import type { ChartBar } from '@/lib/api/ai-coach'
import { bucketStartUnixSeconds, mergeRealtimeMicrobarIntoBars, mergeRealtimePriceIntoBars } from '../chart-realtime'

const BASE_BARS: ChartBar[] = [
  { time: 1_699_999_800, open: 100, high: 101, low: 99, close: 100.5, volume: 1000 },
  { time: 1_700_000_100, open: 100.5, high: 102, low: 100, close: 101.5, volume: 1200 },
]

describe('chart-realtime', () => {
  it('updates the active bar for same timeframe bucket', () => {
    const result = mergeRealtimePriceIntoBars(
      BASE_BARS,
      '5m',
      103,
      new Date((1_700_000_100 + 60) * 1000).toISOString(),
    )

    expect(result.changed).toBe(true)
    expect(result.bars).toHaveLength(2)
    expect(result.bars[1].time).toBe(1_700_000_100)
    expect(result.bars[1].high).toBe(103)
    expect(result.bars[1].low).toBe(100)
    expect(result.bars[1].close).toBe(103)
  })

  it('appends a new bar when tick is in a new bucket', () => {
    const result = mergeRealtimePriceIntoBars(
      BASE_BARS,
      '5m',
      102.5,
      new Date((1_700_000_400 + 5) * 1000).toISOString(),
    )

    expect(result.changed).toBe(true)
    expect(result.bars).toHaveLength(3)
    expect(result.bars[2]).toEqual({
      time: 1_700_000_400,
      open: 101.5,
      high: 102.5,
      low: 101.5,
      close: 102.5,
      volume: 0,
    })
  })

  it('applies slightly out-of-order ticks when the bucket still exists', () => {
    const result = mergeRealtimePriceIntoBars(
      BASE_BARS,
      '5m',
      99.5,
      new Date((1_699_999_800 + 10) * 1000).toISOString(),
    )

    expect(result.changed).toBe(true)
    expect(result.bars).toHaveLength(2)
    expect(result.bars[0].time).toBe(1_699_999_800)
    expect(result.bars[0].low).toBe(99)
    expect(result.bars[0].close).toBe(99.5)
  })

  it('updates the latest daily bar in place', () => {
    const result = mergeRealtimePriceIntoBars(
      BASE_BARS,
      '1D',
      104,
      new Date((1_700_086_400 + 10) * 1000).toISOString(),
    )

    expect(result.changed).toBe(true)
    expect(result.bars).toHaveLength(2)
    expect(result.bars[1].time).toBe(1_700_000_100)
    expect(result.bars[1].high).toBe(104)
    expect(result.bars[1].close).toBe(104)
  })

  it('falls back to current time when timestamp is invalid', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-16T15:30:31.000Z'))
    const expectedBucket = bucketStartUnixSeconds(Math.floor(Date.now() / 1000), '1m')

    const result = mergeRealtimePriceIntoBars(
      [{ time: expectedBucket, open: 100, high: 100, low: 100, close: 100, volume: 0 }],
      '1m',
      101,
      'invalid-timestamp',
    )

    expect(result.changed).toBe(true)
    expect(result.bars[0].time).toBe(expectedBucket)
    expect(result.bars[0].close).toBe(101)
    vi.useRealTimers()
  })

  it('merges realtime microbars into the active 1m candle', () => {
    const result = mergeRealtimeMicrobarIntoBars(
      BASE_BARS,
      '1m',
      {
        bucketStartMs: 1_700_000_100_000,
        open: 101.5,
        high: 102.25,
        low: 101.2,
        close: 102.1,
      },
    )

    expect(result.changed).toBe(true)
    expect(result.bars).toHaveLength(2)
    expect(result.bars[1].time).toBe(1_700_000_100)
    expect(result.bars[1].high).toBe(102.25)
    expect(result.bars[1].low).toBe(100)
    expect(result.bars[1].close).toBe(102.1)
  })

  it('appends a new 1m candle when microbar enters next bucket', () => {
    const result = mergeRealtimeMicrobarIntoBars(
      BASE_BARS,
      '1m',
      {
        bucketStartMs: 1_700_000_160_000,
        open: 101.7,
        high: 102.4,
        low: 101.6,
        close: 102.2,
      },
    )

    expect(result.changed).toBe(true)
    expect(result.bars).toHaveLength(3)
    expect(result.bars[2]).toEqual({
      time: 1_700_000_160,
      open: 101.5,
      high: 102.4,
      low: 101.5,
      close: 102.2,
      volume: 0,
    })
  })
})
