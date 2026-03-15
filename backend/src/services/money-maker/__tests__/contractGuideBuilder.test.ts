import { buildContractGuide } from '../contractGuideBuilder'
import { MoneyMakerExecutionPlan } from '../../../lib/money-maker/types'
import { OptionContract, OptionsChainResponse } from '../../options/types'

function createExecutionPlan(overrides: Partial<MoneyMakerExecutionPlan> = {}): MoneyMakerExecutionPlan {
  return {
    symbol: 'SPY',
    signalId: 'signal-1',
    executionState: 'triggered',
    triggerDistance: -0.04,
    triggerDistancePct: -0.04,
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
    timeWarning: 'normal',
    invalidationReason: 'Long setup invalidates below 100.19.',
    holdWhile: ['Hold while price remains above 101.01.'],
    reduceWhen: ['Reduce at 103.01.'],
    exitImmediatelyWhen: ['Exit below 100.19.'],
    ...overrides,
  }
}

function createContract(overrides: Partial<OptionContract> = {}): OptionContract {
  return {
    symbol: 'SPY',
    strike: 102,
    expiry: '2026-03-20',
    type: 'call',
    last: 2.15,
    bid: 2.05,
    ask: 2.15,
    volume: 240,
    openInterest: 1200,
    impliedVolatility: 0.24,
    delta: 0.45,
    gamma: 0.02,
    theta: -0.08,
    vega: 0.12,
    rho: 0.01,
    inTheMoney: false,
    intrinsicValue: 0.4,
    extrinsicValue: 1.75,
    ...overrides,
  }
}

function createChain(
  expiry: string,
  daysToExpiry: number,
  contracts: OptionContract[],
): OptionsChainResponse {
  return {
    symbol: 'SPY',
    currentPrice: 101.05,
    expiry,
    daysToExpiry,
    ivRank: 28,
    options: {
      calls: contracts.filter((contract) => contract.type === 'call'),
      puts: contracts.filter((contract) => contract.type === 'put'),
    },
  }
}

describe('buildContractGuide', () => {
  it('returns calls only for bullish Money Maker execution plans', () => {
    const result = buildContractGuide({
      executionPlan: createExecutionPlan(),
      chains: [
        createChain('2026-03-20', 6, [
          createContract({ strike: 102, delta: 0.44 }),
          createContract({ strike: 101, delta: 0.56 }),
          createContract({ strike: 103, delta: 0.31, ask: 1.55, bid: 1.45 }),
          createContract({ type: 'put', strike: 100, delta: -0.45, ask: 1.8, bid: 1.7 }),
        ]),
        createChain('2026-03-27', 13, [
          createContract({ expiry: '2026-03-27', strike: 101, delta: 0.57, ask: 2.6, bid: 2.45 }),
        ]),
      ],
    })

    expect(result.contracts).toHaveLength(3)
    expect(result.contracts.every((contract) => contract.type === 'call')).toBe(true)
    expect(result.contracts.map((contract) => contract.label)).toEqual([
      'primary',
      'conservative',
      'lower_cost',
    ])
  })

  it('returns puts only for bearish Money Maker execution plans', () => {
    const result = buildContractGuide({
      executionPlan: createExecutionPlan({
        target1: 98.19,
        target2: 97.4,
      }),
      chains: [
        createChain('2026-03-20', 6, [
          createContract({ type: 'put', strike: 100, delta: -0.44 }),
          createContract({ type: 'put', strike: 99, delta: -0.34, ask: 1.65, bid: 1.55 }),
          createContract({ type: 'call', strike: 102, delta: 0.46 }),
        ]),
        createChain('2026-03-27', 10, [
          createContract({ expiry: '2026-03-27', type: 'put', strike: 101, delta: -0.57, ask: 2.7, bid: 2.5 }),
        ]),
      ],
    })

    expect(result.contracts).toHaveLength(3)
    expect(result.contracts.every((contract) => contract.type === 'put')).toBe(true)
  })

  it('rejects illiquid or overly wide contracts while allowing the volume exception', () => {
    const result = buildContractGuide({
      executionPlan: createExecutionPlan(),
      chains: [
        createChain('2026-03-20', 6, [
          createContract({ strike: 102, delta: 0.44, openInterest: 120, volume: 140 }),
          createContract({ strike: 101, delta: 0.54, bid: 1.6, ask: 2.0, openInterest: 2000, volume: 400 }),
          createContract({ strike: 103, delta: 0.33, openInterest: 900, volume: 250, bid: 1.2, ask: 1.3 }),
        ]),
      ],
    })

    expect(result.contracts.map((contract) => contract.strike)).toContain(102)
    expect(result.contracts.map((contract) => contract.strike)).not.toContain(101)
  })

  it('falls back to the 2-14 DTE window when the preferred DTE band is empty', () => {
    const result = buildContractGuide({
      executionPlan: createExecutionPlan(),
      chains: [
        createChain('2026-03-17', 2, [
          createContract({ strike: 102, delta: 0.45 }),
          createContract({ strike: 103, delta: 0.33, ask: 1.55, bid: 1.45 }),
        ]),
        createChain('2026-03-18', 3, [
          createContract({ strike: 101, delta: 0.56, ask: 2.5, bid: 2.35 }),
        ]),
      ],
    })

    expect(result.contracts).toHaveLength(3)
    expect(result.degradedReason).toContain('Fallback expiry window used for conservative')
  })

  it('returns a degraded response when no valid contracts survive filters', () => {
    const result = buildContractGuide({
      executionPlan: createExecutionPlan({ timeWarning: 'avoid_new_entries' }),
      chains: [
        createChain('2026-03-20', 6, [
          createContract({ strike: 102, delta: 0.1 }),
          createContract({ strike: 101, delta: 0.8, bid: 0.9, ask: 1.5 }),
        ]),
      ],
    })

    expect(result.contracts).toHaveLength(0)
    expect(result.degradedReason).toContain('No valid call contracts survived')
  })
})
