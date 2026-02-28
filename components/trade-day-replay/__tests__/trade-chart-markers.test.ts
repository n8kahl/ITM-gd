import { describe, expect, it } from 'vitest'

import { buildStopPriceLines, buildTradeMarkers } from '@/components/trade-day-replay/trade-chart-markers'
import type { ChartBar, EnrichedTrade } from '@/lib/trade-day-replay/types'

function isoFromEpochSec(seconds: number): string {
  return new Date(seconds * 1000).toISOString()
}

function buildBars(startEpochSec: number): ChartBar[] {
  return [
    { time: startEpochSec, open: 6850, high: 6852, low: 6848, close: 6851, volume: 1000 },
    { time: startEpochSec + 60, open: 6851, high: 6856, low: 6850, close: 6855, volume: 1100 },
    { time: startEpochSec + 120, open: 6855, high: 6860, low: 6853, close: 6858, volume: 1200 },
  ]
}

function makeTrade(
  index: number,
  startEpochSec: number,
  overrides: Partial<EnrichedTrade> = {},
): EnrichedTrade {
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
    entryTimestamp: isoFromEpochSec(startEpochSec + 50),
    exitEvents: [
      { type: 'trim', percentage: 21, timestamp: isoFromEpochSec(startEpochSec + 70) },
      { type: 'full_exit', timestamp: isoFromEpochSec(startEpochSec + 115) },
    ],
    stopLevels: [
      { spxLevel: 6851, timestamp: isoFromEpochSec(startEpochSec + 30) },
    ],
    spxReferences: [6850],
    sizing: 'normal',
    rawMessages: [],
    optionsAtEntry: null,
    evaluation: null,
    pnlPercent: 46,
    isWinner: true,
    holdDurationMin: 12,
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
  }
}

describe('trade-day-replay/trade-chart-markers', () => {
  it('builds native markers for entry, trims, and full exit with selection sizing', () => {
    const base = 1_700_000_000
    const bars = buildBars(base)
    const trades = [makeTrade(1, base)]

    const markers = buildTradeMarkers(trades, bars, 1)

    expect(markers).toHaveLength(3)
    expect(markers.every((marker) => Number(marker.time) >= bars[0]!.time)).toBe(true)
    expect(markers.every((marker) => Number(marker.time) <= bars[bars.length - 1]!.time)).toBe(true)

    const entry = markers.find((marker) => marker.shape === 'arrowUp')
    expect(entry).toBeDefined()
    expect(Number(entry?.time)).toBe(base + 60)
    expect(entry?.position).toBe('belowBar')
    expect(entry?.text).toBe('6900C')
    expect(entry?.size).toBe(3)

    const trim = markers.find((marker) => marker.shape === 'circle')
    expect(trim).toBeDefined()
    expect(trim?.position).toBe('aboveBar')
    expect(trim?.text).toBe('T 21%')
    expect(trim?.size).toBe(2)

    const fullExit = markers.find((marker) => marker.shape === 'arrowDown')
    expect(fullExit).toBeDefined()
    expect(Number(fullExit?.time)).toBe(base + 120)
    expect(fullExit?.text).toBe('+46%')
    expect(fullExit?.size).toBe(3)
  })

  it('ignores events outside the visible bar window', () => {
    const base = 1_700_001_000
    const bars = buildBars(base)
    const trades = [
      makeTrade(1, base),
      makeTrade(2, base, {
        entryTimestamp: isoFromEpochSec(base - 300),
        exitEvents: [{ type: 'full_exit', timestamp: isoFromEpochSec(base - 200) }],
      }),
    ]

    const markers = buildTradeMarkers(trades, bars)

    expect(markers).toHaveLength(3)
    expect(markers.every((marker) => Number(marker.time) >= base)).toBe(true)
  })

  it('builds dashed stop lines for visible unique stop prices only', () => {
    const base = 1_700_002_000
    const bars = buildBars(base)
    const trades = [
      makeTrade(1, base, {
        stopLevels: [
          { spxLevel: 6851, timestamp: isoFromEpochSec(base + 20) },
          { spxLevel: 6851, timestamp: isoFromEpochSec(base + 90) },
          { spxLevel: 6855, timestamp: isoFromEpochSec(base + 300) },
        ],
      }),
      makeTrade(2, base, {
        stopLevels: [{ spxLevel: 6845, timestamp: isoFromEpochSec(base + 80) }],
      }),
    ]

    const lines = buildStopPriceLines(trades, bars)

    expect(lines).toHaveLength(2)
    expect(lines.map((line) => line.title).sort()).toEqual(['Stop 6845.0', 'Stop 6851.0'])
    expect(lines.every((line) => Number(line.lineStyle) === 2)).toBe(true)
    expect(lines.every((line) => Number(line.lineWidth) === 1)).toBe(true)
    expect(lines.every((line) => line.axisLabelVisible === true)).toBe(true)
  })
})
