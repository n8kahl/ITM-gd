import { describe, expect, it } from 'vitest'

import { computeSessionGrade } from '@/lib/trade-day-replay/session-grader'
import type { EnrichedTrade, SessionStats, TradeEvaluation } from '@/lib/trade-day-replay/types'

function makeStats(overrides: Partial<SessionStats> = {}): SessionStats {
  return {
    totalTrades: 4,
    winners: 3,
    losers: 1,
    winRate: 75,
    bestTrade: { index: 1, pctReturn: 30 },
    worstTrade: { index: 2, pctReturn: -12 },
    sessionStartET: '2026-02-27 09:35 ET',
    sessionEndET: '2026-02-27 10:15 ET',
    sessionDurationMin: 40,
    ...overrides,
  }
}

function makeEvaluation(overrides: Partial<TradeEvaluation> = {}): TradeEvaluation {
  return {
    alignmentScore: 70,
    confidence: 72,
    confidenceTrend: 'up',
    expectedValueR: 1.2,
    drivers: ['Baseline driver'],
    risks: ['Baseline risk'],
    ...overrides,
  }
}

function makeTrade(index: number, overrides: Partial<EnrichedTrade> = {}): EnrichedTrade {
  const base: EnrichedTrade = {
    tradeIndex: index,
    contract: {
      symbol: 'SPX',
      strike: 6900,
      type: 'call',
      expiry: '2026-02-27',
    },
    direction: 'long',
    entryPrice: 3.6,
    entryTimestamp: '2026-02-27T09:35:00-05:00',
    exitEvents: [
      { type: 'full_exit', timestamp: '2026-02-27T09:50:00-05:00' },
    ],
    stopLevels: [
      { spxLevel: 6851, timestamp: '2026-02-27T09:37:00-05:00' },
    ],
    spxReferences: [6850],
    sizing: 'normal',
    rawMessages: ['Filled AVG 3.60', 'Fully out'],
    optionsAtEntry: null,
    evaluation: makeEvaluation(),
    pnlPercent: 12,
    isWinner: true,
    holdDurationMin: 15,
  }

  return {
    ...base,
    ...overrides,
    contract: {
      ...base.contract,
      ...(overrides.contract || {}),
    },
    exitEvents: overrides.exitEvents ?? base.exitEvents,
    stopLevels: overrides.stopLevels ?? base.stopLevels,
    spxReferences: overrides.spxReferences ?? base.spxReferences,
    rawMessages: overrides.rawMessages ?? base.rawMessages,
    evaluation: overrides.evaluation ?? base.evaluation,
  }
}

describe('trade-day-replay/session-grader', () => {
  it('returns an A when win rate, R:R, discipline, and risk management are all strong', () => {
    const stats = makeStats({ winRate: 90, winners: 4, losers: 0 })
    const trades: EnrichedTrade[] = [
      makeTrade(1, {
        evaluation: makeEvaluation({ expectedValueR: 2.2, alignmentScore: 88 }),
        exitEvents: [
          { type: 'trim', percentage: 25, timestamp: '2026-02-27T09:45:00-05:00' },
          { type: 'full_exit', timestamp: '2026-02-27T09:55:00-05:00' },
        ],
      }),
      makeTrade(2, { evaluation: makeEvaluation({ expectedValueR: 2.1, alignmentScore: 84 }) }),
      makeTrade(3, {
        evaluation: makeEvaluation({ expectedValueR: 2.3, alignmentScore: 86 }),
        sizing: 'light',
      }),
      makeTrade(4, {
        evaluation: makeEvaluation({ expectedValueR: 2.0, alignmentScore: 85 }),
        exitEvents: [
          { type: 'trim', percentage: 18, timestamp: '2026-02-27T09:48:00-05:00' },
          { type: 'full_exit', timestamp: '2026-02-27T09:58:00-05:00' },
        ],
      }),
    ]

    const result = computeSessionGrade(stats, trades)

    expect(result.grade).toBe('A')
    expect(result.score).toBe(100)
    expect(result.factors.some((factor) => factor.includes('Strong win rate'))).toBe(true)
    expect(result.factors).toContain('Consistent stop usage')
    expect(result.factors).toContain('Active trim management')
    expect(result.factors).toContain('Adaptive position sizing')
  })

  it('returns a C for a mixed session with partial risk controls', () => {
    const stats = makeStats({ winRate: 62, winners: 2, losers: 2 })
    const trades: EnrichedTrade[] = [
      makeTrade(1, {
        evaluation: makeEvaluation({ expectedValueR: 1.1, alignmentScore: 64 }),
        exitEvents: [
          { type: 'trim', percentage: 12, timestamp: '2026-02-27T09:41:00-05:00' },
          { type: 'full_exit', timestamp: '2026-02-27T09:52:00-05:00' },
        ],
      }),
      makeTrade(2, { evaluation: makeEvaluation({ expectedValueR: 1.3, alignmentScore: 66 }) }),
      makeTrade(3, {
        evaluation: makeEvaluation({ expectedValueR: 1.2, alignmentScore: 65 }),
        stopLevels: [],
      }),
      makeTrade(4, {
        evaluation: makeEvaluation({ expectedValueR: 1.2, alignmentScore: 65 }),
        stopLevels: [],
      }),
    ]

    const result = computeSessionGrade(stats, trades)

    expect(result.grade).toBe('C')
    expect(result.score).toBe(64)
    expect(result.factors.some((factor) => factor.includes('Solid win rate'))).toBe(true)
    expect(result.factors).toContain('Partial stop usage')
    expect(result.factors).toContain('Some trim management')
  })

  it('fails low-coverage sessions with no trades to an F', () => {
    const stats = makeStats({
      totalTrades: 0,
      winners: 0,
      losers: 0,
      winRate: 0,
      bestTrade: null,
      worstTrade: null,
    })

    const result = computeSessionGrade(stats, [])

    expect(result.grade).toBe('F')
    expect(result.score).toBe(14)
    expect(result.factors.some((factor) => factor.includes('Low win rate'))).toBe(true)
  })
})
