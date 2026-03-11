import request from 'supertest'
import express from 'express'

const mockAuthGetUser = jest.fn()
const mockFrom = jest.fn()
const mockBuildSnapshot = jest.fn()
const mockHasBackendAdminAccess = jest.fn()

let activeWatchlistRows: Array<{ symbol: string; display_order: number; is_active: boolean }> = []
let defaultWatchlistRows: Array<{ symbol: string; display_order: number }> = [
  { symbol: 'SPY', display_order: 1 },
  { symbol: 'TSLA', display_order: 2 },
]

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
})
