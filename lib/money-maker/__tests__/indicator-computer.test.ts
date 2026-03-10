import { expect, test, describe } from 'vitest'
import { computeVWAP, computeEMA, computeSMA, computeFibonacciLevels } from '../indicator-computer'
import { CandleBar } from '../types'

describe('Indicator Computer', () => {
    const mockBars: CandleBar[] = [
        { timestamp: 1, open: 100, high: 102, low: 98, close: 101, volume: 1000 },
        { timestamp: 2, open: 101, high: 103, low: 100, close: 102, volume: 1500 },
        { timestamp: 3, open: 102, high: 105, low: 101, close: 104, volume: 2000 },
    ]

    test('computeVWAP', () => {
        // tp1 = (102 + 98 + 101) / 3 = 100.333
        // pv1 = 100333.33
        // tp2 = (103 + 100 + 102) / 3 = 101.666
        // pv2 = 152500
        // tp3 = (105 + 101 + 104) / 3 = 103.333
        // pv3 = 206666.66
        // sumPV = 459500
        // sumV = 4500
        // vwap = 102.111
        const vwap = computeVWAP(mockBars)
        expect(vwap).toBeCloseTo(102.11, 2)
    })

    test('computeVWAP returns 0 on empty array', () => {
        expect(computeVWAP([])).toBe(0)
    })

    test('computeEMA', () => {
        const period = 2
        // k = 2 / 3 = 0.666
        // ema1 = 101
        // ema2 = (102 - 101) * 0.666 + 101 = 101.666
        // ema3 = (104 - 101.666) * 0.666 + 101.666 = 103.222
        const ema = computeEMA(mockBars, period)
        expect(ema).toBeCloseTo(103.22, 2)
    })

    test('computeSMA', () => {
        const sma2 = computeSMA(mockBars, 2)
        // last 2 closes: 102, 104
        expect(sma2).toBe(103)
    })

    test('computeSMA returns 0 when not enough bars', () => {
        const sma = computeSMA(mockBars, 5)
        expect(sma).toBe(0)
    })

    test('computeFibonacciLevels', () => {
        const high = 200
        const low = 100
        // range = 100
        const levels = computeFibonacciLevels(high, low)
        expect(levels.retracementFromHigh236).toBeCloseTo(176.4, 1) // 200 - 23.6
        expect(levels.retracementFromHigh382).toBeCloseTo(161.8, 1) // 200 - 38.2
        expect(levels.retracementFromLow236).toBeCloseTo(123.6, 1)  // 100 + 23.6
        expect(levels.retracementFromLow382).toBeCloseTo(138.2, 1)  // 100 + 38.2
    })
})
