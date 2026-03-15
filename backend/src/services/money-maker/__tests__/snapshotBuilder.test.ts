import { buildSnapshot } from '../snapshotBuilder'

const mockFetchAllSymbolData = jest.fn()
const mockBuildConfluenceZones = jest.fn()
const mockDetectPatienceCandle = jest.fn()
const mockDetermineStrategy = jest.fn()
const mockCalculateRR = jest.fn()
const mockRankSignals = jest.fn()

jest.mock('../symbolDataFetcher', () => ({
  fetchAllSymbolData: (...args: unknown[]) => mockFetchAllSymbolData(...args),
}))

jest.mock('../../../lib/money-maker/confluence-detector', () => ({
  buildConfluenceZones: (...args: unknown[]) => mockBuildConfluenceZones(...args),
}))

jest.mock('../../../lib/money-maker/patience-candle-detector', () => ({
  detectPatienceCandle: (...args: unknown[]) => mockDetectPatienceCandle(...args),
}))

jest.mock('../../../lib/money-maker/kcu-strategy-router', () => ({
  determineStrategy: (...args: unknown[]) => mockDetermineStrategy(...args),
}))

jest.mock('../../../lib/money-maker/rr-calculator', () => ({
  calculateRR: (...args: unknown[]) => mockCalculateRR(...args),
}))

jest.mock('../../../lib/money-maker/signal-ranker', () => ({
  rankSignals: (...args: unknown[]) => mockRankSignals(...args),
}))

jest.mock('../../../config/database', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

function makeBar(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number = 1000,
) {
  return { timestamp, open, high, low, close, volume }
}

function createMultiSessionFixture() {
  const bars5m = [
    makeBar(Date.UTC(2026, 2, 9, 13, 30), 98, 100, 97, 99),
    makeBar(Date.UTC(2026, 2, 9, 13, 35), 99, 100, 98, 99.5),
    makeBar(Date.UTC(2026, 2, 9, 13, 40), 99.5, 100, 98.5, 99),
    makeBar(Date.UTC(2026, 2, 10, 13, 30), 198, 200, 197, 199),
    makeBar(Date.UTC(2026, 2, 10, 13, 35), 199, 201, 198, 200),
    makeBar(Date.UTC(2026, 2, 10, 13, 40), 200, 202, 195, 196),
    makeBar(Date.UTC(2026, 2, 10, 13, 45), 196, 197, 189, 190),
  ]

  const bars1h = [
    makeBar(Date.UTC(2026, 2, 5, 15, 0), 175, 180, 170, 178),
    makeBar(Date.UTC(2026, 2, 6, 15, 0), 178, 190, 176, 188),
    makeBar(Date.UTC(2026, 2, 9, 15, 0), 188, 205, 184, 200),
    makeBar(Date.UTC(2026, 2, 10, 15, 0), 200, 210, 198, 206),
  ]

  const bars1d = [
    makeBar(Date.UTC(2026, 2, 9, 0, 0), 180, 205, 175, 198),
    makeBar(Date.UTC(2026, 2, 10, 0, 0), 198, 210, 189, 206),
  ]

  return {
    SPY: {
      '5Min': bars5m,
      '10Min': [],
      '1H': bars1h,
      '1D': bars1d,
    },
  }
}

function createSignalFixture() {
  const bars5m = [
    makeBar(Date.UTC(2026, 2, 10, 13, 30), 198, 200, 197, 199),
    makeBar(Date.UTC(2026, 2, 10, 13, 35), 199, 201, 198, 200),
    makeBar(Date.UTC(2026, 2, 10, 13, 40), 200, 202, 199, 201),
    makeBar(Date.UTC(2026, 2, 10, 13, 45), 201, 201.5, 199.5, 200),
  ]

  const bars1h = [
    makeBar(Date.UTC(2026, 2, 7, 15, 0), 188, 194, 184, 192),
    makeBar(Date.UTC(2026, 2, 8, 15, 0), 192, 199, 190, 198),
    makeBar(Date.UTC(2026, 2, 9, 15, 0), 198, 205, 196, 204),
    makeBar(Date.UTC(2026, 2, 10, 15, 0), 204, 210, 202, 209),
  ]

  const bars1d = [
    makeBar(Date.UTC(2026, 2, 9, 0, 0), 190, 206, 186, 202),
    makeBar(Date.UTC(2026, 2, 10, 0, 0), 202, 210, 198, 209),
  ]

  return {
    SPY: {
      '5Min': bars5m,
      '10Min': [],
      '1H': bars1h,
      '1D': bars1d,
    },
  }
}

describe('buildSnapshot baseline contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBuildConfluenceZones.mockReturnValue([])
    mockDetectPatienceCandle.mockReturnValue({ isPatienceCandle: false })
    mockDetermineStrategy.mockReturnValue({ isValid: false })
    mockCalculateRR.mockReturnValue({
      entry: 0,
      stop: 0,
      target: 0,
      risk: 0,
      reward: 0,
      riskRewardRatio: 0,
      isValid: false,
    })
    mockRankSignals.mockImplementation((signals: unknown[]) => signals)
  })

  it('derives ORB regime from the current regular session rather than the earliest fetched bars', async () => {
    mockFetchAllSymbolData.mockResolvedValue(createMultiSessionFixture())

    const snapshot = await buildSnapshot(['SPY'])

    expect(snapshot.symbolSnapshots[0]?.orbRegime).toBe('trending_down')
  })

  it('passes the full V1 confluence inputs into zone construction', async () => {
    mockFetchAllSymbolData.mockResolvedValue(createMultiSessionFixture())

    await buildSnapshot(['SPY'])

    const rawLevels = mockBuildConfluenceZones.mock.calls[0]?.[0] as Array<{ source: string }>
    const sources = rawLevels.map((level) => level.source)

    expect(sources).toEqual(
      expect.arrayContaining([
        'ORB High',
        'ORB Low',
        'Open Price',
        'Fib 0.236',
        'Fib 0.382',
        'Hourly High',
        'Hourly Low',
      ]),
    )
    expect(sources.some((source) => /^Hourly (High|Low) \d/.test(source))).toBe(false)
  })

  it('returns a board-friendly hourly ladder and hides incomplete long-lookback indicators', async () => {
    mockFetchAllSymbolData.mockResolvedValue(createMultiSessionFixture())

    const snapshot = await buildSnapshot(['SPY'])

    expect(snapshot.symbolSnapshots[0]).toEqual(
      expect.objectContaining({
        hourlyLevels: {
          nearestSupport: 184,
          nextSupport: 176,
          nearestResistance: 205,
          nextResistance: 210,
        },
        indicators: expect.objectContaining({
          sma200: null,
        }),
      }),
    )
  })

  it('uses the next hourly level when calculating risk-reward', async () => {
    mockFetchAllSymbolData.mockResolvedValue(createSignalFixture())
    mockBuildConfluenceZones.mockReturnValue([
      {
        priceLow: 199.8,
        priceHigh: 200.2,
        score: 3.1,
        label: 'strong',
        levels: [{ source: 'VWAP', price: 200, weight: 1.5 }],
        isKingQueen: true,
      },
    ])
    mockDetectPatienceCandle.mockReturnValue({
      isPatienceCandle: true,
      pattern: 'hammer',
      bodyToRangeRatio: 0.2,
      dominantWickRatio: 0.65,
    })
    mockDetermineStrategy.mockReturnValue({
      isValid: true,
      strategyType: 'KING_AND_QUEEN',
      strategyLabel: 'King & Queen',
    })
    mockCalculateRR.mockReturnValue({
      entry: 202.01,
      stop: 199.99,
      target: 210,
      risk: 2.02,
      reward: 7.99,
      riskRewardRatio: 3.96,
      isValid: true,
    })

    await buildSnapshot(['SPY'])

    expect(mockCalculateRR).toHaveBeenCalledWith(
      expect.objectContaining({
        nextLevel: 205,
      }),
    )
  })
})
