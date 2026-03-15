import request from 'supertest'
import express from 'express'

const mockAuthGetUser = jest.fn()
const mockFrom = jest.fn()
const mockBuildSnapshot = jest.fn()
const mockBuildWorkspace = jest.fn()
const mockHasBackendAdminAccess = jest.fn()

let activeWatchlistRows: Array<{ symbol: string; display_order: number; is_active: boolean }> = []
let defaultWatchlistRows: Array<{ symbol: string; display_order: number }> = [
  { symbol: 'SPY', display_order: 1 },
  { symbol: 'TSLA', display_order: 2 },
]

function createWorkspaceFixture() {
  return {
    symbolSnapshot: {
      symbol: 'SPY',
      price: 683.1,
      priceChange: 1.2,
      priceChangePercent: 0.18,
      orbRegime: 'trending_up',
      strongestConfluence: null,
      hourlyLevels: {
        nearestSupport: 681.4,
        nextSupport: 680.8,
        nearestResistance: 684.2,
        nextResistance: 685.1,
      },
      indicators: {
        vwap: 682.4,
        ema8: 682.1,
        ema21: 681.6,
        ema34: 681.2,
        sma200: null,
      },
      lastCandleAt: 1773163800000,
    },
    activeSignal: {
      id: 'signal-1',
      symbol: 'SPY',
      timestamp: 1773163800000,
      strategyType: 'KING_AND_QUEEN',
      strategyLabel: 'King & Queen',
      direction: 'long',
      patienceCandle: {
        pattern: 'hammer',
        bar: {
          timestamp: 1773163800000,
          open: 682.8,
          high: 683.2,
          low: 682.1,
          close: 683.0,
          volume: 1000,
        },
        bodyToRangeRatio: 0.2,
        dominantWickRatio: 0.65,
        timeframe: '5m',
      },
      confluenceZone: {
        priceLow: 682.1,
        priceHigh: 682.8,
        score: 4.1,
        label: 'fortress',
        levels: [{ source: 'VWAP', price: 682.4, weight: 1.5 }],
        isKingQueen: true,
      },
      entry: 683.21,
      stop: 682.09,
      target: 685.1,
      riskRewardRatio: 2.12,
      orbRegime: 'trending_up',
      trendStrength: 82,
      signalRank: 1,
      status: 'ready',
      ttlSeconds: 300,
      expiresAt: 1773164100000,
    },
    executionPlan: {
      symbol: 'SPY',
      signalId: 'signal-1',
      executionState: 'triggered',
      triggerDistance: -0.12,
      triggerDistancePct: -0.02,
      entry: 683.21,
      stop: 682.09,
      target1: 685.1,
      target2: 686.4,
      riskPerShare: 1.12,
      rewardToTarget1: 1.89,
      rewardToTarget2: 3.19,
      riskRewardRatio: 2.12,
      entryQuality: 'ideal',
      idealEntryLow: 683.21,
      idealEntryHigh: 683.38,
      chaseCutoff: 683.49,
      timeWarning: 'normal',
      invalidationReason: 'Long setup invalidates below 682.09.',
      holdWhile: ['Hold above trigger.'],
      reduceWhen: ['Reduce at target 1.'],
      exitImmediatelyWhen: ['Exit below stop.'],
    },
    contracts: [
      {
        label: 'primary',
        optionSymbol: 'SPY 2026-03-20 C 684',
        expiry: '2026-03-20',
        strike: 684,
        type: 'call',
        bid: 2.1,
        ask: 2.2,
        mid: 2.15,
        spreadPct: 4.65,
        delta: 0.45,
        theta: -0.08,
        impliedVolatility: 0.24,
        openInterest: 1200,
        volume: 400,
        premiumPerContract: 220,
        dte: 6,
        quality: 'green',
        explanation: 'best balance of delta fit and spread quality',
      },
    ],
    generatedAt: 1773163800000,
    degradedReason: null,
  }
}

function createSelectBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn().mockResolvedValue(result),
  }

  return builder
}

jest.mock('../../config/database', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockAuthGetUser(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

jest.mock('../../services/money-maker/snapshotBuilder', () => ({
  buildSnapshot: (...args: unknown[]) => mockBuildSnapshot(...args),
}))

jest.mock('../../services/money-maker/workspaceBuilder', () => ({
  buildWorkspace: (...args: unknown[]) => mockBuildWorkspace(...args),
}))

jest.mock('../../lib/adminAccess', () => ({
  hasBackendAdminAccess: (...args: unknown[]) => mockHasBackendAdminAccess(...args),
}))

import moneyMakerRoutes from '../../routes/money-maker'

const app = express()
app.use(express.json())
app.use('/api/money-maker', moneyMakerRoutes)

describe('Money Maker API auth contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    activeWatchlistRows = []
    defaultWatchlistRows = [
      { symbol: 'SPY', display_order: 1 },
      { symbol: 'TSLA', display_order: 2 },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'money_maker_watchlists') {
        return createSelectBuilder({ data: activeWatchlistRows, error: null })
      }

      if (table === 'money_maker_default_symbols') {
        return createSelectBuilder({ data: defaultWatchlistRows, error: null })
      }

      return createSelectBuilder({ data: [], error: null })
    })

    mockBuildSnapshot.mockResolvedValue({
      timestamp: 1773163800000,
      signals: [],
      symbolSnapshots: [
        {
          symbol: 'SPY',
          price: 683.1,
          priceChange: 1.2,
          priceChangePercent: 0.18,
          orbRegime: 'trending_up',
          strongestConfluence: null,
          indicators: {
            vwap: 682.4,
            ema8: 682.1,
            ema21: 681.6,
            ema34: 681.2,
            sma200: 677.8,
          },
          lastCandleAt: 1773163800000,
        },
      ],
    })
    mockBuildWorkspace.mockResolvedValue(createWorkspaceFixture())
    mockHasBackendAdminAccess.mockResolvedValue(true)
  })

  it('returns 401 when the backend route is unauthenticated', async () => {
    const res = await request(app).get('/api/money-maker/snapshot')

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Unauthorized' })
    expect(mockBuildSnapshot).not.toHaveBeenCalled()
  })

  it('returns 403 for authenticated non-admin users', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'member-1',
          app_metadata: { is_admin: false },
        },
      },
      error: null,
    })
    mockHasBackendAdminAccess.mockResolvedValue(false)

    const res = await request(app)
      .get('/api/money-maker/snapshot')
      .set('Authorization', 'Bearer member-token')

    expect(res.status).toBe(403)
    expect(mockBuildSnapshot).not.toHaveBeenCalled()
  })

  it('allows authenticated admin users to receive a snapshot', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-1',
          app_metadata: { is_admin: true },
        },
      },
      error: null,
    })

    const res = await request(app)
      .get('/api/money-maker/snapshot')
      .set('Authorization', 'Bearer admin-token')

    expect(res.status).toBe(200)
    expect(res.body.symbols).toEqual(['SPY', 'TSLA'])
    expect(mockBuildSnapshot).toHaveBeenCalledWith(['SPY', 'TSLA'], 'admin-1')
  })

  it('returns 400 for workspace requests without a valid symbol', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-1',
          app_metadata: { is_admin: true },
        },
      },
      error: null,
    })

    const res = await request(app)
      .get('/api/money-maker/workspace')
      .set('Authorization', 'Bearer admin-token')

    expect(res.status).toBe(400)
    expect(mockBuildWorkspace).not.toHaveBeenCalled()
  })

  it('returns a symbol-scoped workspace payload for authenticated admins', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-1',
          app_metadata: { is_admin: true },
        },
      },
      error: null,
    })

    const res = await request(app)
      .get('/api/money-maker/workspace?symbol=spy')
      .set('Authorization', 'Bearer admin-token')

    expect(res.status).toBe(200)
    expect(res.body.symbolSnapshot.symbol).toBe('SPY')
    expect(res.body.executionPlan.executionState).toBe('triggered')
    expect(res.body.contracts[0].type).toBe('call')
    expect(mockBuildWorkspace).toHaveBeenCalledWith({
      symbol: 'SPY',
      userId: 'admin-1',
    })
  })

  it('returns degraded plan-only and contracts-only payloads from the shared workspace builder', async () => {
    mockAuthGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'admin-1',
          app_metadata: { is_admin: true },
        },
      },
      error: null,
    })
    mockBuildWorkspace.mockResolvedValue({
      ...createWorkspaceFixture(),
      activeSignal: null,
      executionPlan: null,
      contracts: [],
      generatedAt: 1773163800000,
      degradedReason: 'Options data is temporarily unavailable.',
    })

    const planRes = await request(app)
      .get('/api/money-maker/plan?symbol=SPY')
      .set('Authorization', 'Bearer admin-token')
    const contractsRes = await request(app)
      .get('/api/money-maker/contracts?symbol=SPY')
      .set('Authorization', 'Bearer admin-token')

    expect(planRes.status).toBe(200)
    expect(planRes.body.executionPlan).toBeNull()
    expect(planRes.body.degradedReason).toContain('temporarily unavailable')
    expect(contractsRes.status).toBe(200)
    expect(contractsRes.body.contracts).toEqual([])
    expect(contractsRes.body.degradedReason).toContain('temporarily unavailable')
  })
})
