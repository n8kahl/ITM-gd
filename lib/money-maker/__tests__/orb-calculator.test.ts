import { expect, test, describe } from 'vitest'
import { computeORB, determineRegime } from '../orb-calculator'
import { CandleBar } from '../types'

describe('ORB Calculator', () => {
    describe('computeORB', () => {
        test('returns high and low of given bars', () => {
            const bars: CandleBar[] = [
                { timestamp: 1, open: 100, high: 105, low: 98, close: 101, volume: 1000 },
                { timestamp: 2, open: 101, high: 106, low: 99, close: 102, volume: 1000 },
                { timestamp: 3, open: 102, high: 104, low: 97, close: 103, volume: 1000 },
            ]
            const orb = computeORB(bars)
            expect(orb?.high).toBe(106)
            expect(orb?.low).toBe(97)
        })

        test('returns null for empty bars', () => {
            expect(computeORB([])).toBeNull()
        })
    })

    describe('determineRegime', () => {
        const orb = { high: 105, low: 95 }

        test('returns trending_up when price > orb.high', () => {
            expect(determineRegime(106, orb)).toBe('trending_up')
        })

        test('returns trending_down when price < orb.low', () => {
            expect(determineRegime(94, orb)).toBe('trending_down')
        })

        test('returns choppy when price inside orb', () => {
            expect(determineRegime(100, orb)).toBe('choppy')
        })

        test('returns choppy when price equals orb high/low', () => {
            expect(determineRegime(105, orb)).toBe('choppy')
            expect(determineRegime(95, orb)).toBe('choppy')
        })

        test('returns choppy when orb is null', () => {
            expect(determineRegime(100, null)).toBe('choppy')
        })
    })
})
