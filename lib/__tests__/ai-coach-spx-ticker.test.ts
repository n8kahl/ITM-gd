import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetChartData } = vi.hoisted(() => ({
  mockGetChartData: vi.fn(),
}))

vi.mock('@/lib/api/ai-coach', () => ({
  getChartData: (...args: unknown[]) => mockGetChartData(...args),
}))

import { buildSpxTickerSnapshot, loadSpxTickerSnapshot } from '@/lib/ai-coach-spx-ticker'

describe('AI coach SPX ticker snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the previous daily close when the daily feed already contains the current session', () => {
    const snapshot = buildSpxTickerSnapshot(
      [
        {
          time: Date.parse('2026-03-17T19:30:00Z') / 1000,
          open: 5741,
          high: 5753,
          low: 5738,
          close: 5750,
          volume: 0,
        },
      ],
      [
        {
          time: Date.parse('2026-03-16T20:00:00Z') / 1000,
          open: 5678,
          high: 5712,
          low: 5669,
          close: 5700,
          volume: 0,
        },
        {
          time: Date.parse('2026-03-17T20:00:00Z') / 1000,
          open: 5702,
          high: 5754,
          low: 5698,
          close: 5748,
          volume: 0,
        },
      ],
    )

    expect(snapshot).toMatchObject({
      price: 5750,
      change: 50,
      changePct: 0.88,
    })
    expect(snapshot?.asOf).toBeTruthy()
  })

  it('falls back to the latest completed daily close when the daily feed lags intraday', () => {
    const snapshot = buildSpxTickerSnapshot(
      [
        {
          time: Date.parse('2026-03-17T19:30:00Z') / 1000,
          open: 5741,
          high: 5753,
          low: 5738,
          close: 5750,
          volume: 0,
        },
      ],
      [
        {
          time: Date.parse('2026-03-16T20:00:00Z') / 1000,
          open: 5678,
          high: 5712,
          low: 5669,
          close: 5700,
          volume: 0,
        },
      ],
    )

    expect(snapshot).toMatchObject({
      price: 5750,
      change: 50,
      changePct: 0.88,
    })
  })

  it('can recover from an intraday fetch failure when daily bars are still available', async () => {
    mockGetChartData
      .mockRejectedValueOnce(new Error('intraday offline'))
      .mockResolvedValueOnce({
        symbol: 'SPX',
        timeframe: '1D',
        bars: [
          {
            time: Date.parse('2026-03-14T20:00:00Z') / 1000,
            open: 5560,
            high: 5592,
            low: 5555,
            close: 5580,
            volume: 0,
          },
          {
            time: Date.parse('2026-03-17T20:00:00Z') / 1000,
            open: 5582,
            high: 5615,
            low: 5570,
            close: 5600,
            volume: 0,
          },
        ],
      })

    await expect(loadSpxTickerSnapshot('token')).resolves.toMatchObject({
      price: 5600,
      change: 20,
      changePct: 0.36,
    })
  })
})
