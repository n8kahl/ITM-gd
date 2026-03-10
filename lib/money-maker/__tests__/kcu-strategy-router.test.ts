import { expect, test, describe } from 'vitest'
import { determineStrategy, getETTimeStr, StrategyRouterContext } from '../kcu-strategy-router'
import { ConfluenceZone } from '../types'

function createDateAtET(hhmm: string): number {
    const [hh, mm] = hhmm.split(':')
    // We use a fixed date and assume correct timezone parsing to test
    // 2026-03-10 is a Tuesday (Standard time, wait daylight saving? March is usually EDT. Either way the Intl.DateTimeFormat handles it)
    // Let's create an ISO string that corresponds to ET
    // EDT is UTC-4. EST is UTC-5. March 10 2026 is EDT (starts March 8).
    return new Date(`2026-03-10T${hh}:${mm}:00-04:00`).getTime()
}

describe('Strategy Router', () => {
    describe('getETTimeStr', () => {
        test('correctly parses time to eastern', () => {
            expect(getETTimeStr(createDateAtET('09:45'))).toBe('09:45')
            expect(getETTimeStr(createDateAtET('14:30'))).toBe('14:30')
        })
    })

    describe('determineStrategy', () => {
        const baseZone: ConfluenceZone = {
            priceLow: 100, priceHigh: 101, score: 3.0, label: 'strong', isKingQueen: false, levels: []
        }

        test('blocks before 9:35', () => {
            const ctx: StrategyRouterContext = {
                timestamp: createDateAtET('09:34'),
                orbRegime: 'trending_up',
                confluenceZone: baseZone
            }
            const res = determineStrategy(ctx)
            expect(res.isValid).toBe(false)
            expect(res.reason).toContain('Before 9:35 ET')
        })

        test('blocks after 3:00 PM', () => {
            const ctx: StrategyRouterContext = {
                timestamp: createDateAtET('15:01'),
                orbRegime: 'trending_up',
                confluenceZone: baseZone
            }
            const res = determineStrategy(ctx)
            expect(res.isValid).toBe(false)
            expect(res.reason).toContain('After 3:00 PM ET')
        })

        test('choppy regime requires VWAP', () => {
            const ctx: StrategyRouterContext = {
                timestamp: createDateAtET('10:15'),
                orbRegime: 'choppy',
                confluenceZone: { ...baseZone, isKingQueen: false }
            }
            const res = determineStrategy(ctx)
            expect(res.isValid).toBe(false)
            expect(res.reason).toBe('Choppy regime requires VWAP confluence')
        })

        test('assigns King & Queen', () => {
            const ctx: StrategyRouterContext = {
                timestamp: createDateAtET('09:45'),
                orbRegime: 'choppy', // allowed because it has VWAP
                confluenceZone: {
                    ...baseZone,
                    isKingQueen: true,
                    levels: [{ source: 'VWAP', price: 100, weight: 1.5 }, { source: '8 EMA', price: 100, weight: 1.2 }]
                }
            }
            const res = determineStrategy(ctx)
            expect(res.isValid).toBe(true)
            expect(res.strategyType).toBe('KING_AND_QUEEN')
        })

        test('assigns Cloud Strategy', () => {
            const ctx: StrategyRouterContext = {
                timestamp: createDateAtET('13:30'),
                orbRegime: 'trending_up',
                isMorningTrend: true,
                confluenceZone: {
                    ...baseZone,
                    levels: [{ source: 'Ripster Cloud', price: 100, weight: 1.0 }]
                }
            }
            const res = determineStrategy(ctx)
            expect(res.isValid).toBe(true)
            expect(res.strategyType).toBe('CLOUD_STRATEGY')
        })

        test('assigns Fib Reject Strategy for shorts', () => {
            const ctx: StrategyRouterContext = {
                timestamp: createDateAtET('09:50'),
                orbRegime: 'trending_down',
                isPrevDayTrend: true,
                direction: 'short',
                confluenceZone: {
                    ...baseZone,
                    levels: [{ source: 'Fib 0.382', price: 100, weight: 1.1 }]
                }
            }
            const res = determineStrategy(ctx)
            expect(res.isValid).toBe(true)
            expect(res.strategyType).toBe('FIB_REJECT')
        })
    })
})
