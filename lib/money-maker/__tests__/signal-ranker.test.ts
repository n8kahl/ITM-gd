import { expect, test, describe } from 'vitest'
import { rankSignals } from '../signal-ranker'
import { MoneyMakerSignal } from '../types'

describe('Signal Ranker', () => {
    function createSignalMock(id: string, score: number, rr: number, trend: number): MoneyMakerSignal {
        return {
            id,
            symbol: 'SPY',
            timestamp: 1000,
            strategyType: 'KING_AND_QUEEN',
            strategyLabel: 'King & Queen',
            direction: 'long',
            patienceCandle: { pattern: 'hammer', bar: { timestamp: 1, open: 1, close: 1, low: 1, high: 1, volume: 1 }, bodyToRangeRatio: 0, dominantWickRatio: 0, timeframe: '5m' },
            confluenceZone: { priceLow: 1, priceHigh: 1, score, label: 'strong', levels: [], isKingQueen: true },
            entry: 1, stop: 1, target: 1, riskRewardRatio: rr,
            orbRegime: 'trending_up', trendStrength: trend,
            signalRank: 0,
            status: 'forming', ttlSeconds: 60, expiresAt: 1000
        }
    }

    test('ranks signals strictly according to priority', () => {
        const s1 = createSignalMock('s1', 3.0, 2.5, 80) // highest score = 3
        const s2 = createSignalMock('s2', 4.0, 2.0, 50) // highest score = 4 -> Rank 1
        const s3 = createSignalMock('s3', 3.0, 3.0, 90) // score = 3, higher RR -> Rank 2
        const s4 = createSignalMock('s4', 3.0, 2.5, 90) // score = 3, RR=2.5, higher trend -> Rank 3
        const s5 = createSignalMock('s5', 2.5, 5.0, 100) // score = 2.5 -> Rank 5
        // s1: score=3, RR=2.5, trend=80 -> Rank 4

        const ranked = rankSignals([s1, s2, s3, s4, s5])

        expect(ranked[0].id).toBe('s2')
        expect(ranked[0].signalRank).toBe(1)

        expect(ranked[1].id).toBe('s3')
        expect(ranked[1].signalRank).toBe(2)

        expect(ranked[2].id).toBe('s4')
        expect(ranked[2].signalRank).toBe(3)

        expect(ranked[3].id).toBe('s1')
        expect(ranked[3].signalRank).toBe(4)

        expect(ranked[4].id).toBe('s5')
        expect(ranked[4].signalRank).toBe(5)
    })
})
