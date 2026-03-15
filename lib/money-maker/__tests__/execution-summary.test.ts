import { describe, expect, it } from 'vitest'

import { summarizeMoneyMakerExecution } from '../execution-summary'

const baseSignal = {
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

const baseSnapshot = {
    symbol: 'SPY',
    price: 100.9,
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

describe('summarizeMoneyMakerExecution', () => {
    it('derives an armed state before trigger with target progress and target2', () => {
        const summary = summarizeMoneyMakerExecution(baseSignal, baseSnapshot, Date.UTC(2026, 2, 16, 15, 45))

        expect(summary).toEqual(expect.objectContaining({
            executionState: 'armed',
            entryQuality: 'ideal',
            targetProgress: 'T1 pending',
            target2: 104.2,
            timeWarning: 'normal',
        }))
    })

    it('closes the state outside the regular session', () => {
        const summary = summarizeMoneyMakerExecution(baseSignal, baseSnapshot, Date.UTC(2026, 2, 16, 22, 15))

        expect(summary?.executionState).toBe('closed')
        expect(summary?.targetProgress).toBe('Market closed')
        expect(summary?.timeWarning).toBe('avoid_new_entries')
    })
})
