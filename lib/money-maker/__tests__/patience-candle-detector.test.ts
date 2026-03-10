import { expect, test, describe } from 'vitest'
import { detectPatienceCandle, getDynamicBandTolerance } from '../patience-candle-detector'
import { CandleBar, DEFAULT_CONFIG } from '../types'

describe('getDynamicBandTolerance', () => {
    test('scales correctly with price', () => {
        expect(getDynamicBandTolerance(15)).toBe(0.05)
        expect(getDynamicBandTolerance(50)).toBe(0.10)
        expect(getDynamicBandTolerance(90)).toBe(0.20)
        expect(getDynamicBandTolerance(150)).toBe(0.30)
        expect(getDynamicBandTolerance(400)).toBe(0.50)
        expect(getDynamicBandTolerance(1000)).toBe(1.00)
        expect(getDynamicBandTolerance(3000)).toBe(2.00)
    })
})

describe('detectPatienceCandle - Bullish (Long)', () => {
    const baseLevel = 100.00 // band tolerance at $100 is 0.20
    const recentCandles: CandleBar[] = [
        { timestamp: 1, open: 105, high: 106, low: 104, close: 104, volume: 1000 },
        { timestamp: 2, open: 104, high: 105, low: 103, close: 103, volume: 1000 },
        { timestamp: 3, open: 103, high: 104, low: 102, close: 102, volume: 1000 },
        { timestamp: 4, open: 102, high: 103, low: 101, close: 101, volume: 1000 },
        { timestamp: 5, open: 101, high: 102, low: 100, close: 100, volume: 1000 },
    ] // avg volume = 1000, avg range = 2

    test('valid bullish hammer', () => {
        const candle: CandleBar = {
            timestamp: 6,
            open: 100.80,
            close: 100.90, // body size 0.10
            low: 100.10,   // lower wick 0.70 (ratio 0.77)
            high: 101.00,  // upper wick 0.10 (ratio 0.11)
            volume: 1200   // volume ratio 1.2
        }
        // range: 0.90. relative range: 0.90/2 = 0.45 
        const result = detectPatienceCandle(candle, 'long', recentCandles, baseLevel)
        expect(result.isPatienceCandle).toBe(true)
        expect(result.pattern).toBe('hammer')
        expect(result.dominantWickRatio).toBeCloseTo(0.777, 2)
    })

    test('valid bullish hammer (red body)', () => {
        const candle: CandleBar = {
            timestamp: 6,
            open: 100.90,
            close: 100.80, // red body, still a hammer
            low: 100.10,
            high: 101.00,
            volume: 1200
        }
        const result = detectPatienceCandle(candle, 'long', recentCandles, baseLevel)
        expect(result.isPatienceCandle).toBe(true)
    })

    test('fails if body is too large', () => {
        const candle: CandleBar = {
            timestamp: 6,
            open: 100.50,
            close: 100.90, // body size 0.40
            low: 100.10,   // lower wick 0.40
            high: 101.00,  // upper wick 0.10
            volume: 1200   // range = 0.90 (body ratio = 0.44 > 0.35)
        }
        const result = detectPatienceCandle(candle, 'long', recentCandles, baseLevel)
        expect(result.isPatienceCandle).toBe(false)
        expect(result.reason).toBe('Body too large compared to range')
    })

    test('fails if lower wick is too short', () => {
        const candle: CandleBar = {
            timestamp: 6,
            open: 100.20,
            close: 100.30,
            low: 100.00,   // lower wick 0.20
            high: 101.00,  // upper wick 0.70
            volume: 1200   // range = 1.0 (lower wick ratio 0.20 < 0.50)
        }
        const result = detectPatienceCandle(candle, 'long', recentCandles, baseLevel)
        expect(result.isPatienceCandle).toBe(false)
        expect(result.reason).toBe('Dominant wick too short')
    })

    test('fails if upper wick is too long (spinning top validation)', () => {
        const candle: CandleBar = {
            timestamp: 6,
            open: 100.50,
            close: 100.60,
            low: 100.00,   // lower wick 0.50
            high: 101.00,  // upper wick 0.40
            volume: 1200   // range = 1.0. Lower wick is 0.50 (passes), but upper wick 0.40 (fails > 0.15)
        }
        const result = detectPatienceCandle(candle, 'long', recentCandles, baseLevel)
        expect(result.isPatienceCandle).toBe(false)
        expect(result.reason).toBe('Opposing wick too long')
    })

    test('fails if not at key level', () => {
        const candle: CandleBar = {
            timestamp: 6,
            open: 100.80,
            close: 100.90,
            low: 100.35,   // distance to 100.00 is 0.35 > 0.30 (tolerance)
            high: 100.95,  // upper wick 0.05, range 0.60
            volume: 1200
        }
        const result = detectPatienceCandle(candle, 'long', recentCandles, baseLevel)
        expect(result.isPatienceCandle).toBe(false)
        expect(result.reason).toBe('Not at key level')
    })

    test('fails if volume is too low (ghost candle)', () => {
        const candle: CandleBar = {
            timestamp: 6,
            open: 100.80,
            close: 100.90,
            low: 100.10,
            high: 101.00,
            volume: 400    // volume ratio = 0.4 < 0.50
        }
        const result = detectPatienceCandle(candle, 'long', recentCandles, baseLevel)
        expect(result.isPatienceCandle).toBe(false)
        expect(result.reason).toBe('Volume too low (ghost candle)')
    })

    test('fails if candle range is too large relative to recent trend', () => {
        const candle: CandleBar = {
            timestamp: 6,
            open: 101.30,
            close: 101.40,
            low: 99.70,   // distance to 100.00 is 0.30 <= 0.30 (tolerance)
            high: 101.60, // range 1.90 (1.90/2.0 = 0.95 > 0.75 ratio)
            volume: 1200
        }
        const result = detectPatienceCandle(candle, 'long', recentCandles, baseLevel)
        expect(result.isPatienceCandle).toBe(false)
        expect(result.reason).toBe('Candle range too large relative to recent candles')
    })
})

describe('detectPatienceCandle - Bearish (Short)', () => {
    const baseLevel = 200.00 // band tolerance at $200 is 0.30
    const recentCandles: CandleBar[] = [
        { timestamp: 1, open: 195, high: 196, low: 194, close: 196, volume: 1000 },
        { timestamp: 2, open: 196, high: 197, low: 195, close: 197, volume: 1000 },
        { timestamp: 3, open: 197, high: 198, low: 196, close: 198, volume: 1000 },
        { timestamp: 4, open: 198, high: 199, low: 197, close: 199, volume: 1000 },
        { timestamp: 5, open: 199, high: 200, low: 198, close: 200, volume: 1000 },
    ] // avg volume = 1000, avg range = 2

    test('valid bearish inverted hammer', () => {
        const candle: CandleBar = {
            timestamp: 6,
            open: 199.10,
            close: 199.20, // body size 0.10
            low: 199.00,   // lower wick 0.10 (ratio 0.11)
            high: 199.90,  // upper wick 0.70 (ratio 0.77)
            volume: 1200   // volume ratio 1.2
        }
        // range: 0.90. relative range: 0.90/2 = 0.45 
        const result = detectPatienceCandle(candle, 'short', recentCandles, baseLevel)
        expect(result.isPatienceCandle).toBe(true)
        expect(result.pattern).toBe('inverted_hammer')
    })

    test('fails if not at key level', () => {
        const candle: CandleBar = {
            timestamp: 6,
            open: 198.10,
            close: 198.20,
            low: 198.00,
            high: 198.90,  // distance to 200.00 is 1.10 > 0.30 (tolerance)
            volume: 1200
        }
        const result = detectPatienceCandle(candle, 'short', recentCandles, baseLevel)
        expect(result.isPatienceCandle).toBe(false)
        expect(result.reason).toBe('Not at key level')
    })
})
