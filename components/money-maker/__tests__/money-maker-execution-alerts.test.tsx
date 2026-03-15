/* @vitest-environment jsdom */

import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseMoneyMaker, mockToast } = vi.hoisted(() => ({
  mockUseMoneyMaker: vi.fn(),
  mockToast: vi.fn(),
}))

vi.mock('../money-maker-provider', () => ({
  useMoneyMaker: (...args: unknown[]) => mockUseMoneyMaker(...args),
}))

vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}))

import { MoneyMakerExecutionAlerts } from '../money-maker-execution-alerts'

const signal = {
  id: 'signal-1',
  symbol: 'SPY',
  timestamp: Date.UTC(2026, 2, 16, 15, 0),
  strategyType: 'KING_AND_QUEEN' as const,
  strategyLabel: 'King & Queen',
  direction: 'long' as const,
  patienceCandle: {
    pattern: 'hammer' as const,
    bar: {
      timestamp: Date.UTC(2026, 2, 16, 15, 0),
      open: 100.2,
      high: 101.1,
      low: 99.9,
      close: 100.8,
      volume: 1000,
    },
    bodyToRangeRatio: 0.2,
    dominantWickRatio: 0.55,
    timeframe: '5m' as const,
  },
  confluenceZone: {
    priceLow: 100.0,
    priceHigh: 100.6,
    score: 4.2,
    label: 'fortress' as const,
    levels: [{ source: 'VWAP', price: 100.4, weight: 1.5 }],
    isKingQueen: true,
  },
  entry: 101.0,
  stop: 100.2,
  target: 103.0,
  riskRewardRatio: 2.5,
  orbRegime: 'trending_up' as const,
  trendStrength: 84,
  signalRank: 1,
  status: 'ready' as const,
  ttlSeconds: 600,
  expiresAt: Date.UTC(2026, 2, 16, 15, 10),
}

function createSnapshot(price: number) {
  return {
    symbol: 'SPY',
    price,
    priceChange: 0.5,
    priceChangePercent: 0.5,
    orbRegime: 'trending_up' as const,
    strongestConfluence: {
      priceLow: 100.0,
      priceHigh: 100.6,
      score: 4.2,
      label: 'fortress' as const,
      levels: [{ source: 'VWAP', price: 100.4, weight: 1.5 }],
      isKingQueen: true,
    },
    hourlyLevels: {
      nearestSupport: 100.4,
      nextSupport: 99.9,
      nearestResistance: 103.0,
      nextResistance: 104.2,
    },
    indicators: {
      vwap: 100.4,
      ema8: 100.6,
      ema21: 100.2,
      ema34: 99.9,
      sma200: null,
    },
    lastCandleAt: Date.UTC(2026, 2, 16, 15, 0),
  }
}

describe('MoneyMakerExecutionAlerts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T15:45:00.000Z'))
    mockToast.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires one toast per real execution-state transition', () => {
    let currentState = {
      signals: [signal],
      symbolSnapshots: [createSnapshot(100.9)],
      lastUpdated: 1,
    }

    mockUseMoneyMaker.mockImplementation(() => ({
      state: currentState,
    }))

    const { rerender } = render(<MoneyMakerExecutionAlerts />)

    expect(mockToast).not.toHaveBeenCalled()

    currentState = {
      ...currentState,
      symbolSnapshots: [createSnapshot(101.05)],
      lastUpdated: 2,
    }

    rerender(<MoneyMakerExecutionAlerts />)

    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledWith('SPY triggered', expect.objectContaining({
      description: expect.stringContaining('T1 103.00'),
    }))

    currentState = {
      ...currentState,
      lastUpdated: 3,
    }

    rerender(<MoneyMakerExecutionAlerts />)

    expect(mockToast).toHaveBeenCalledTimes(1)
  })
})
