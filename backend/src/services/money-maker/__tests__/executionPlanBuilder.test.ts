import { buildExecutionPlan } from '../executionPlanBuilder'
import { MoneyMakerSignal, MoneyMakerSymbolSnapshot } from '../../../lib/money-maker/types'

function createSignal(overrides: Partial<MoneyMakerSignal> = {}): MoneyMakerSignal {
  return {
    id: 'signal-1',
    symbol: 'SPY',
    timestamp: Date.UTC(2026, 2, 10, 16, 0),
    strategyType: 'KING_AND_QUEEN',
    strategyLabel: 'King & Queen',
    direction: 'long',
    patienceCandle: {
      pattern: 'hammer',
      bar: {
        timestamp: Date.UTC(2026, 2, 10, 16, 0),
        open: 100.4,
        high: 101,
        low: 100.2,
        close: 100.8,
        volume: 1000,
      },
      bodyToRangeRatio: 0.2,
      dominantWickRatio: 0.65,
      timeframe: '5m',
    },
    confluenceZone: {
      priceLow: 100.2,
      priceHigh: 100.8,
      score: 4.2,
      label: 'fortress',
      levels: [{ source: 'VWAP', price: 100.5, weight: 1.5 }],
      isKingQueen: true,
    },
    entry: 101.01,
    stop: 100.19,
    target: 103.01,
    riskRewardRatio: 2.44,
    orbRegime: 'trending_up',
    trendStrength: 84,
    signalRank: 1,
    status: 'ready',
    ttlSeconds: 300,
    expiresAt: Date.UTC(2026, 2, 10, 16, 5),
    ...overrides,
  }
}

function createSymbolSnapshot(overrides: Partial<MoneyMakerSymbolSnapshot> = {}): MoneyMakerSymbolSnapshot {
  return {
    symbol: 'SPY',
    price: 101.05,
    priceChange: 0.45,
    priceChangePercent: 0.45,
    orbRegime: 'trending_up',
    strongestConfluence: {
      priceLow: 100.2,
      priceHigh: 100.8,
      score: 4.2,
      label: 'fortress',
      levels: [{ source: 'VWAP', price: 100.5, weight: 1.5 }],
      isKingQueen: true,
    },
    hourlyLevels: {
      nearestSupport: 100.4,
      nextSupport: 99.8,
      nearestResistance: 103.01,
      nextResistance: 104.25,
    },
    indicators: {
      vwap: 100.5,
      ema8: 100.72,
      ema21: 100.44,
      ema34: 100.28,
      sma200: null,
    },
    lastCandleAt: Date.UTC(2026, 2, 10, 16, 15),
    ...overrides,
  }
}

describe('buildExecutionPlan', () => {
  it('builds a deterministic long execution plan from the canonical signal and symbol snapshot', () => {
    const plan = buildExecutionPlan({
      signal: createSignal(),
      symbolSnapshot: createSymbolSnapshot(),
      currentTimestamp: Date.UTC(2026, 2, 10, 16, 15),
    })

    expect(plan).toEqual(
      expect.objectContaining({
        symbol: 'SPY',
        signalId: 'signal-1',
        executionState: 'triggered',
        entry: 101.01,
        stop: 100.19,
        target1: 103.01,
        target2: 104.25,
        riskPerShare: 0.82,
        rewardToTarget1: 2,
        rewardToTarget2: 3.24,
        riskRewardRatio: 2.44,
        entryQuality: 'ideal',
        idealEntryLow: 101.01,
        idealEntryHigh: 101.11,
        chaseCutoff: 101.16,
        triggerDistance: -0.04,
        triggerDistancePct: -0.04,
        timeWarning: 'normal',
      }),
    )
    expect(plan?.invalidationReason).toContain('100.19')
    expect(plan?.holdWhile).toEqual(expect.arrayContaining([
      expect.stringContaining('above 101.01'),
      expect.stringContaining('VWAP'),
    ]))
    expect(plan?.reduceWhen).toEqual(expect.arrayContaining([
      expect.stringContaining('103.01'),
      expect.stringContaining('104.25'),
    ]))
    expect(plan?.exitImmediatelyWhen).toEqual(expect.arrayContaining([
      expect.stringContaining('100.19'),
    ]))
  })

  it('selects the next resistance above target 1 for long target 2', () => {
    const plan = buildExecutionPlan({
      signal: createSignal(),
      symbolSnapshot: createSymbolSnapshot({
        price: 103.2,
        hourlyLevels: {
          nearestSupport: 101.8,
          nextSupport: 101.2,
          nearestResistance: 104.25,
          nextResistance: 105.1,
        },
      }),
      currentTimestamp: Date.UTC(2026, 2, 10, 16, 20),
    })

    expect(plan?.target2).toBe(104.25)
    expect(plan?.executionState).toBe('target2_in_play')
  })

  it('selects the next support below target 1 for short target 2', () => {
    const plan = buildExecutionPlan({
      signal: createSignal({
        symbol: 'TSLA',
        direction: 'short',
        orbRegime: 'trending_down',
        entry: 100.19,
        stop: 101.01,
        target: 98.19,
      }),
      symbolSnapshot: createSymbolSnapshot({
        symbol: 'TSLA',
        price: 100.12,
        orbRegime: 'trending_down',
        hourlyLevels: {
          nearestSupport: 98.19,
          nextSupport: 97.4,
          nearestResistance: 100.9,
          nextResistance: 101.4,
        },
      }),
      currentTimestamp: Date.UTC(2026, 2, 10, 16, 15),
    })

    expect(plan).toEqual(
      expect.objectContaining({
        symbol: 'TSLA',
        target1: 98.19,
        target2: 97.4,
        executionState: 'triggered',
      }),
    )
    expect(plan?.holdWhile[0]).toContain('below 100.19')
  })

  it('returns null when an active signal or current symbol snapshot is missing', () => {
    expect(
      buildExecutionPlan({
        signal: null,
        symbolSnapshot: createSymbolSnapshot(),
        currentTimestamp: Date.UTC(2026, 2, 10, 16, 15),
      }),
    ).toBeNull()

    expect(
      buildExecutionPlan({
        signal: createSignal(),
        symbolSnapshot: null,
        currentTimestamp: Date.UTC(2026, 2, 10, 16, 15),
      }),
    ).toBeNull()
  })
})
