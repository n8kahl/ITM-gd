import { expect, test, describe } from 'vitest'
import { getLevelProximityTolerance, buildConfluenceZones } from '../confluence-detector'
import { ConfluenceLevel } from '../types'

describe('Confluence Detector', () => {
    describe('getLevelProximityTolerance', () => {
        test('calculates correct tolerance based on price and timeframe', () => {
            expect(getLevelProximityTolerance(100, '2m')).toBeCloseTo(0.15)
            expect(getLevelProximityTolerance(100, '5m')).toBeCloseTo(0.20)
            expect(getLevelProximityTolerance(100, '10m')).toBeCloseTo(0.25)
            expect(getLevelProximityTolerance(500, '5m')).toBeCloseTo(1.00)
        })
    })

    describe('buildConfluenceZones', () => {
        // 5m timeframe tolerance for 100 is 0.20
        const toleranceRef = 100

        test('clusters levels within tolerance and calculates score properly', () => {
            const levels: ConfluenceLevel[] = [
                { source: 'VWAP', price: 100.05, weight: 1.5 },
                { source: '8 EMA', price: 100.15, weight: 1.2 }, // distance to VWAP is 0.10 <= 0.20
                { source: '21 EMA', price: 100.25, weight: 1.0 }, // distance to 8 EMA is 0.10 <= 0.20
                { source: 'Hourly S/R', price: 102.00, weight: 1.4 } // distance to 21 EMA is 1.75 > 0.20 (new zone)
            ]

            const zones = buildConfluenceZones(levels, toleranceRef, '5m')

            // Should create 1 zone with score >= 2.0 (the 102.00 zone has score 1.4, which is filtered out)
            expect(zones).toHaveLength(1)

            const firstZone = zones[0]
            expect(firstZone.levels).toHaveLength(3)
            expect(firstZone.priceLow).toBe(100.05)
            expect(firstZone.priceHigh).toBe(100.25)
            expect(firstZone.score).toBeCloseTo(3.7, 1) // 1.5 + 1.2 + 1.0 = 3.7
            expect(firstZone.label).toBe('strong')
            expect(firstZone.isKingQueen).toBe(true) // contains VWAP
        })

        test('filters out zones with score < 2.0', () => {
            const levels: ConfluenceLevel[] = [
                { source: 'Open Price', price: 90.00, weight: 1.0 }, // Score 1.0, filtered out
                { source: 'VWAP', price: 100.00, weight: 1.5 },
                { source: '8 EMA', price: 100.10, weight: 1.2 }, // Clusters with VWAP -> score 2.7
            ]

            const zones = buildConfluenceZones(levels, 100, '5m')
            expect(zones).toHaveLength(1)
            expect(zones[0].score).toBe(2.7)
            expect(zones[0].levels.some(l => l.source === 'Open Price')).toBe(false)
        })

        test('labels zones correctly', () => {
            // moderate: 2.0 - 2.9
            // strong: 3.0 - 3.9
            // fortress: 4.0+
            const moderateLevels: ConfluenceLevel[] = [
                { source: '8 EMA', price: 50.00, weight: 1.2 },
                { source: 'Open Price', price: 50.05, weight: 1.0 },
            ] // score 2.2
            const moderateZones = buildConfluenceZones(moderateLevels, 50, '5m')
            expect(moderateZones[0].label).toBe('moderate')
            expect(moderateZones[0].isKingQueen).toBe(false)

            const fortressLevels: ConfluenceLevel[] = [
                { source: 'VWAP', price: 50.00, weight: 1.5 },
                { source: '8 EMA', price: 50.02, weight: 1.2 },
                { source: '21 EMA', price: 50.04, weight: 1.0 },
                { source: '200 SMA', price: 50.06, weight: 1.3 },
            ] // score 5.0
            const fortressZones = buildConfluenceZones(fortressLevels, 50, '5m')
            expect(fortressZones[0].label).toBe('fortress')
            expect(fortressZones[0].isKingQueen).toBe(true)
        })
    })
})
