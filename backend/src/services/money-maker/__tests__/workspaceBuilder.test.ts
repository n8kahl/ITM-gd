import { buildWorkspace } from '../workspaceBuilder'

const mockCacheGet = jest.fn()
const mockCacheSet = jest.fn()
const mockBuildSnapshot = jest.fn()
const mockFetchExpirationDates = jest.fn()
const mockFetchOptionsChain = jest.fn()
const mockSupabaseFrom = jest.fn()

jest.mock('../../../config/redis', () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}))

jest.mock('../snapshotBuilder', () => ({
  buildSnapshot: (...args: unknown[]) => mockBuildSnapshot(...args),
}))

jest.mock('../../options/optionsChainFetcher', () => ({
  fetchExpirationDates: (...args: unknown[]) => mockFetchExpirationDates(...args),
  fetchOptionsChain: (...args: unknown[]) => mockFetchOptionsChain(...args),
}))

jest.mock('../../../config/database', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}))

function makeInsertBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: any = {
    insert: jest.fn(() => builder),
    select: jest.fn(() => builder),
    single: jest.fn().mockResolvedValue({
      data: result.data ?? null,
      error: result.error ?? null,
    }),
  }

  return builder
}

function makeSimpleInsertBuilder(error: unknown = null) {
  const builder: any = {
    insert: jest.fn().mockResolvedValue({
      error,
    }),
  }

  return builder
}

function createSnapshotFixture() {
  return {
    timestamp: Date.UTC(2026, 2, 10, 16, 15),
    signals: [
      {
        id: 'signal-1',
        symbol: 'SPY',
        timestamp: Date.UTC(2026, 2, 10, 16, 0),
        strategyType: 'KING_AND_QUEEN',
        strategyLabel: 'King & Queen',
        direction: 'long',
        patienceCandle: {
          pattern: 'hammer',
          bar: {
            timestamp: Date.UTC(2026, 2, 10, 16, 0),
            open: 100.4,
            high: 101,
            low: 100.2,
            close: 100.8,
            volume: 1000,
          },
          bodyToRangeRatio: 0.2,
          dominantWickRatio: 0.65,
          timeframe: '5m',
        },
        confluenceZone: {
          priceLow: 100.2,
          priceHigh: 100.8,
          score: 4.2,
          label: 'fortress',
          levels: [{ source: 'VWAP', price: 100.5, weight: 1.5 }],
          isKingQueen: true,
        },
        entry: 101.01,
        stop: 100.19,
        target: 103.01,
        riskRewardRatio: 2.44,
        orbRegime: 'trending_up',
        trendStrength: 84,
        signalRank: 1,
        status: 'ready',
        ttlSeconds: 300,
        expiresAt: Date.UTC(2026, 2, 10, 16, 5),
      },
    ],
    symbolSnapshots: [
      {
        symbol: 'SPY',
        price: 101.05,
        priceChange: 0.45,
        priceChangePercent: 0.45,
        orbRegime: 'trending_up',
        strongestConfluence: {
          priceLow: 100.2,
          priceHigh: 100.8,
          score: 4.2,
          label: 'fortress',
          levels: [{ source: 'VWAP', price: 100.5, weight: 1.5 }],
          isKingQueen: true,
        },
        hourlyLevels: {
          nearestSupport: 100.4,
          nextSupport: 99.8,
          nearestResistance: 103.01,
          nextResistance: 104.25,
        },
        indicators: {
          vwap: 100.5,
          ema8: 100.72,
          ema21: 100.44,
          ema34: 100.28,
          sma200: null,
        },
        lastCandleAt: Date.UTC(2026, 2, 10, 16, 15),
      },
    ],
  }
}

function createChainFixture() {
  return {
    symbol: 'SPY',
    currentPrice: 101.05,
    expiry: '2026-03-20',
    daysToExpiry: 6,
    ivRank: 28,
    options: {
      calls: [
        {
          symbol: 'SPY',
          strike: 102,
          expiry: '2026-03-20',
          type: 'call',
          last: 2.15,
          bid: 2.05,
          ask: 2.15,
          volume: 240,
          openInterest: 1200,
          impliedVolatility: 0.24,
          delta: 0.45,
          gamma: 0.02,
          theta: -0.08,
          vega: 0.12,
          rho: 0.01,
          inTheMoney: false,
          intrinsicValue: 0.4,
          extrinsicValue: 1.75,
        },
      ],
      puts: [],
    },
  }
}

describe('buildWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-03-10T16:15:00.000Z'))

    mockCacheGet.mockResolvedValue(null)
    mockCacheSet.mockResolvedValue(undefined)
    mockBuildSnapshot.mockResolvedValue(createSnapshotFixture())
    mockFetchExpirationDates.mockResolvedValue(['2026-03-20'])
    mockFetchOptionsChain.mockResolvedValue(createChainFixture())
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'money_maker_guidance_snapshots') {
        return makeInsertBuilder({ data: { id: 'guidance-1' } })
      }

      if (table === 'money_maker_contract_guidance') {
        return makeSimpleInsertBuilder()
      }

      return makeSimpleInsertBuilder()
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns a cached workspace without rebuilding snapshot or contract data', async () => {
    mockCacheGet.mockResolvedValue({
      symbolSnapshot: { symbol: 'SPY' },
      activeSignal: null,
      executionPlan: null,
      contracts: [],
      generatedAt: 123,
      degradedReason: 'cached',
    })

    const workspace = await buildWorkspace({
      symbol: 'SPY',
      userId: 'admin-1',
    })

    expect(workspace.degradedReason).toBe('cached')
    expect(mockBuildSnapshot).not.toHaveBeenCalled()
    expect(mockFetchOptionsChain).not.toHaveBeenCalled()
  })

  it('builds and persists a symbol-scoped workspace with plan and contract guidance', async () => {
    const workspace = await buildWorkspace({
      symbol: 'SPY',
      userId: 'admin-1',
    })

    expect(mockBuildSnapshot).toHaveBeenCalledWith(['SPY'], 'admin-1')
    expect(mockFetchExpirationDates).toHaveBeenCalledWith('SPY', {
      maxDaysAhead: 21,
      maxPages: 4,
    })
    expect(mockFetchOptionsChain).toHaveBeenCalledWith('SPY', '2026-03-20', 12)
    expect(workspace.executionPlan?.symbol).toBe('SPY')
    expect(workspace.contracts[0]?.type).toBe('call')
    expect(workspace.degradedReason).toBeNull()
    expect(mockSupabaseFrom).toHaveBeenCalledWith('money_maker_guidance_snapshots')
    expect(mockSupabaseFrom).toHaveBeenCalledWith('money_maker_contract_guidance')
    expect(mockCacheSet).toHaveBeenCalledTimes(1)
  })

  it('returns a degraded workspace when contract-chain fetch fails while keeping the plan intact', async () => {
    mockFetchExpirationDates.mockRejectedValue(new Error('provider down'))

    const workspace = await buildWorkspace({
      symbol: 'SPY',
      userId: 'admin-1',
    })

    expect(workspace.executionPlan).not.toBeNull()
    expect(workspace.contracts).toEqual([])
    expect(workspace.degradedReason).toContain('Options data is temporarily unavailable')
    expect(mockSupabaseFrom).toHaveBeenCalledWith('money_maker_guidance_snapshots')
  })

  it('does not persist when no active signal is available', async () => {
    mockBuildSnapshot.mockResolvedValue({
      ...createSnapshotFixture(),
      signals: [],
    })

    const workspace = await buildWorkspace({
      symbol: 'SPY',
      userId: 'admin-1',
    })

    expect(workspace.executionPlan).toBeNull()
    expect(workspace.contracts).toEqual([])
    expect(workspace.degradedReason).toContain('No active Money Maker signal')
    expect(mockSupabaseFrom).not.toHaveBeenCalledWith('money_maker_guidance_snapshots')
  })
})
