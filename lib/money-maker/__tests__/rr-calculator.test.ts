import { expect, test, describe } from 'vitest'
import { calculateRR } from '../rr-calculator'

describe('RR Calculator', () => {
    const patienceCandle = {
        timestamp: 1,
        open: 100.5,
        close: 100.8,
        low: 100.2, // long entry stop depends on this
        high: 101.0, // long entry is above this
        volume: 1000
    }

    test('calculates correct RR for long setups', () => {
        // direction = 'long'
        // entry = 101.0 + 0.01 = 101.01
        // stop = 100.2 - 0.01 = 100.19
        // risk = 101.01 - 100.19 = 0.82
        // target = 103.00
        // reward = 103.00 - 101.01 = 1.99
        // rr = 1.99 / 0.82 = 2.426. >= 2.0 -> valid
        const res = calculateRR({
            patienceCandle, direction: 'long', nextLevel: 103.00, tickSize: 0.01
        })

        expect(res.entry).toBe(101.01)
        expect(res.stop).toBe(100.19)
        expect(res.target).toBe(103.00)
        expect(res.risk).toBe(0.82)
        expect(res.reward).toBe(1.99)
        expect(res.riskRewardRatio).toBeCloseTo(2.43, 2)
        expect(res.isValid).toBe(true)
    })

    test('invalid for RR < 2.0', () => {
        // target is closer, e.g. 102.00
        // reward = 102.00 - 101.01 = 0.99
        // risk = 0.82
        // rr = 0.99 / 0.82 = 1.20 -> invalid
        const res = calculateRR({
            patienceCandle, direction: 'long', nextLevel: 102.00, tickSize: 0.01
        })

        expect(res.isValid).toBe(false)
    })

    test('calculates correct RR for short setups', () => {
        // direction = 'short'
        // entry = 100.2 - 0.01 = 100.19
        // stop = 101.0 + 0.01 = 101.01
        // risk = 101.01 - 100.19 = 0.82
        // target = 98.00
        // reward = 100.19 - 98.00 = 2.19
        // rr = 2.19 / 0.82 = 2.67 -> valid
        const res = calculateRR({
            patienceCandle, direction: 'short', nextLevel: 98.00, tickSize: 0.01
        })

        expect(res.entry).toBe(100.19)
        expect(res.stop).toBe(101.01)
        expect(res.target).toBe(98.00)
        expect(res.risk).toBe(0.82)
        expect(res.reward).toBe(2.19)
        expect(res.riskRewardRatio).toBeCloseTo(2.67, 2)
        expect(res.isValid).toBe(true)
    })
})
