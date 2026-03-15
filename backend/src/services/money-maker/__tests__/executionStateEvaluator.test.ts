import { evaluateExecutionState } from '../executionStateEvaluator'
import { MoneyMakerSignal } from '../../../lib/money-maker/types'

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

describe('evaluateExecutionState', () => {
  it('keeps long setups in watching until price is within one risk unit of the trigger', () => {
    const signal = createSignal()

    const evaluation = evaluateExecutionState({
      signal,
      currentPrice: 100.29,
      currentTimestamp: Date.UTC(2026, 2, 10, 16, 15),
      target2: 104.25,
    })

    expect(evaluation.executionState).toBe('watching')
    expect(evaluation.entryQuality).toBe('ideal')
    expect(evaluation.triggerDistance).toBe(0.72)
    expect(evaluation.timeWarning).toBe('normal')
  })

  it('arms long setups when price is close to the trigger, then marks ideal / acceptable / late after trigger', () => {
    const signal = createSignal()
    const currentTimestamp = Date.UTC(2026, 2, 10, 16, 15)

    const armed = evaluateExecutionState({
      signal,
      currentPrice: 100.5,
      currentTimestamp,
      target2: 104.25,
    })
    const ideal = evaluateExecutionState({
      signal,
      currentPrice: 101.05,
      currentTimestamp,
      target2: 104.25,
    })
    const acceptable = evaluateExecutionState({
      signal,
      currentPrice: 101.13,
      currentTimestamp,
      target2: 104.25,
    })
    const late = evaluateExecutionState({
      signal,
      currentPrice: 101.25,
      currentTimestamp,
      target2: 104.25,
    })

    expect(armed.executionState).toBe('armed')
    expect(ideal.executionState).toBe('triggered')
    expect(ideal.entryQuality).toBe('ideal')
    expect(acceptable.executionState).toBe('triggered')
    expect(acceptable.entryQuality).toBe('acceptable')
    expect(late.executionState).toBe('extended')
    expect(late.entryQuality).toBe('late')
  })

  it('promotes long setups through target states and fails them below the stop', () => {
    const signal = createSignal()
    const currentTimestamp = Date.UTC(2026, 2, 10, 16, 15)

    const atTarget1 = evaluateExecutionState({
      signal,
      currentPrice: 103.01,
      currentTimestamp,
      target2: 104.25,
    })
    const extension = evaluateExecutionState({
      signal,
      currentPrice: 103.2,
      currentTimestamp,
      target2: 104.25,
    })
    const failed = evaluateExecutionState({
      signal,
      currentPrice: 100.18,
      currentTimestamp,
      target2: 104.25,
    })

    expect(atTarget1.executionState).toBe('target1_hit')
    expect(extension.executionState).toBe('target2_in_play')
    expect(failed.executionState).toBe('failed')
  })

  it('handles short setups symmetrically', () => {
    const signal = createSignal({
      direction: 'short',
      orbRegime: 'trending_down',
      entry: 100.19,
      stop: 101.01,
      target: 98.19,
    })

    const triggered = evaluateExecutionState({
      signal,
      currentPrice: 100.12,
      currentTimestamp: Date.UTC(2026, 2, 10, 16, 15),
      target2: 97.5,
    })
    const failed = evaluateExecutionState({
      signal,
      currentPrice: 101.05,
      currentTimestamp: Date.UTC(2026, 2, 10, 16, 15),
      target2: 97.5,
    })

    expect(triggered.executionState).toBe('triggered')
    expect(triggered.entryQuality).toBe('ideal')
    expect(failed.executionState).toBe('failed')
  })

  it('marks late-session caution after 1:30 PM ET, avoid-new-entries after 2:00 PM ET, and closes after the session', () => {
    const signal = createSignal()

    const lateSession = evaluateExecutionState({
      signal,
      currentPrice: 100.5,
      currentTimestamp: Date.UTC(2026, 2, 10, 17, 31),
      target2: 104.25,
    })
    const avoidNewEntries = evaluateExecutionState({
      signal,
      currentPrice: 100.5,
      currentTimestamp: Date.UTC(2026, 2, 10, 18, 1),
      target2: 104.25,
    })
    const closed = evaluateExecutionState({
      signal,
      currentPrice: 100.5,
      currentTimestamp: Date.UTC(2026, 2, 10, 20, 5),
      target2: 104.25,
    })

    expect(lateSession.timeWarning).toBe('late_session')
    expect(avoidNewEntries.timeWarning).toBe('avoid_new_entries')
    expect(closed.executionState).toBe('closed')
    expect(closed.timeWarning).toBe('avoid_new_entries')
  })
})
