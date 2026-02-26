import type { Page, Route } from '@playwright/test'
import { authenticateAsMember } from '../../helpers/member-auth'

export const E2E_USER_ID = '00000000-0000-4000-8000-000000000001'

// ---------------------------------------------------------------------------
// Auth & Shell Setup
// ---------------------------------------------------------------------------

export async function enableDashboardBypass(page: Page): Promise<void> {
  await authenticateAsMember(page, { bypassMiddleware: true })
  await page.context().addCookies([
    {
      name: 'e2e_bypass_auth',
      value: '1',
      domain: '127.0.0.1',
      path: '/',
    },
    {
      name: 'e2e_bypass_auth',
      value: '1',
      domain: 'localhost',
      path: '/',
    },
  ])
}

export async function setupDashboardShellMocks(page: Page): Promise<void> {
  // Config roles
  await page.route('**/api/config/roles*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  // Config tabs
  await page.route('**/api/config/tabs*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { tab_id: 'dashboard', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 1, label: 'Dashboard', icon: 'home', path: '/members' },
          { tab_id: 'journal', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 2, label: 'Journal', icon: 'book', path: '/members/journal' },
          { tab_id: 'ai-coach', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 3, label: 'AI Coach', icon: 'bot', path: '/members/ai-coach' },
          { tab_id: 'library', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 4, label: 'Academy', icon: 'book-open', path: '/members/library' },
          { tab_id: 'profile', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 5, label: 'Profile', icon: 'user', path: '/members/profile' },
          { tab_id: 'spx-command-center', required_tier: 'pro', is_active: true, is_required: false, mobile_visible: true, sort_order: 6, label: 'SPX', icon: 'target', path: '/members/spx-command-center' },
          { tab_id: 'social', required_tier: 'core', is_active: true, is_required: false, mobile_visible: false, sort_order: 7, label: 'Social', icon: 'users', path: '/members/social' },
        ],
      }),
    })
  })

  // Member profile
  await page.route('**/api/members/profile*', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: E2E_USER_ID,
          discord_username: 'E2ETrader',
          email: 'e2e@example.com',
          membership_tier: 'pro',
          discord_roles: ['role-core-sniper', 'role-pro'],
          discord_avatar: null,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      }),
    })
  })
}

// ---------------------------------------------------------------------------
// Dashboard Stats
// ---------------------------------------------------------------------------

export interface MockDashboardStats {
  win_rate: number
  pnl_mtd: number
  pnl_change_pct: number
  current_streak: number
  streak_type: 'win' | 'loss'
  best_streak: number
  avg_ai_grade: string | null
  trades_mtd: number
  trades_last_month: number
}

export function createMockDashboardStats(
  overrides: Partial<MockDashboardStats> = {},
): MockDashboardStats {
  return {
    win_rate: 62.5,
    pnl_mtd: 1250.75,
    pnl_change_pct: 8.3,
    current_streak: 3,
    streak_type: 'win',
    best_streak: 7,
    avg_ai_grade: 'B',
    trades_mtd: 24,
    trades_last_month: 31,
    ...overrides,
  }
}

export async function setupDashboardStatsMock(
  page: Page,
  stats?: MockDashboardStats,
): Promise<void> {
  const data = stats ?? createMockDashboardStats()

  await page.route('**/api/members/dashboard/stats*', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    })
  })
}

// ---------------------------------------------------------------------------
// Equity Curve
// ---------------------------------------------------------------------------

export interface MockEquityCurvePoint {
  date: string
  cumulative_pnl: number
  drawdown: number
}

export function createMockEquityCurve(days = 30): MockEquityCurvePoint[] {
  const points: MockEquityCurvePoint[] = []
  let cum = 0
  let peak = 0

  for (let i = 0; i < days; i++) {
    const delta = (Math.random() - 0.4) * 100
    cum += delta
    peak = Math.max(peak, cum)
    points.push({
      date: `2026-02-${String((i % 28) + 1).padStart(2, '0')}`,
      cumulative_pnl: Math.round(cum * 100) / 100,
      drawdown: peak > 0 ? Math.round(((peak - cum) / peak) * 100) / 100 : 0,
    })
  }

  return points
}

export async function setupEquityCurveMock(page: Page): Promise<void> {
  await page.route('**/api/members/dashboard/equity-curve*', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: createMockEquityCurve() }),
    })
  })
}

// ---------------------------------------------------------------------------
// Recent Trades (uses journal API)
// ---------------------------------------------------------------------------

export interface MockRecentTrade {
  id: string
  symbol: string
  direction: 'long' | 'short'
  pnl: number | null
  ai_grade?: string | null
  trade_date: string
  created_at: string
}

export function createMockRecentTrades(count = 5): MockRecentTrade[] {
  const symbols = ['SPY', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'QQQ', 'AMD']
  const trades: MockRecentTrade[] = []

  for (let i = 0; i < count; i++) {
    const isWin = i % 3 !== 1
    trades.push({
      id: `trade-${i + 1}`,
      symbol: symbols[i % symbols.length],
      direction: i % 2 === 0 ? 'long' : 'short',
      pnl: isWin ? 50 + Math.round(Math.random() * 200) : -(30 + Math.round(Math.random() * 100)),
      ai_grade: ['A', 'B', 'C', null][i % 4],
      trade_date: new Date(Date.now() - i * 3600_000 * 4).toISOString(),
      created_at: new Date(Date.now() - i * 3600_000 * 4).toISOString(),
    })
  }

  return trades
}

export async function setupRecentTradesMock(
  page: Page,
  trades?: MockRecentTrade[],
): Promise<void> {
  const data = trades ?? createMockRecentTrades()

  await page.route('**/api/members/journal?limit=5*', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    })
  })
}

// ---------------------------------------------------------------------------
// Market Ticker & Status
// ---------------------------------------------------------------------------

export async function setupMarketDataMocks(page: Page): Promise<void> {
  // Market indices
  await page.route('**/api/market/indices*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          indices: [
            { symbol: 'SPX', name: 'S&P 500', price: 6050.25, change: 15.30, changePercent: 0.25, source: 'mock' },
            { symbol: 'NDX', name: 'Nasdaq 100', price: 21450.80, change: -42.10, changePercent: -0.20, source: 'mock' },
            { symbol: 'SPY', name: 'SPDR S&P 500', price: 604.12, change: 1.58, changePercent: 0.26, source: 'mock' },
            { symbol: 'QQQ', name: 'Invesco QQQ', price: 522.33, change: -1.05, changePercent: -0.20, source: 'mock' },
          ],
          source: 'e2e-mock',
        },
      }),
    })
  })

  // Market status
  await page.route('**/api/market/status*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          status: 'open',
          session: 'regular',
        },
      }),
    })
  })

  // Market analytics
  await page.route('**/api/market/analytics*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          risk_regime: 'Risk-On',
          market_breadth: { advance_decline_ratio: 1.8, advancing: 320, declining: 180 },
          vix: { level: 14.5, change: -0.8, percentile: 25 },
          divergence: null,
          skew: null,
        },
      }),
    })
  })

  // Market movers
  await page.route('**/api/market/movers*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          gainers: [
            { symbol: 'NVDA', price: 920.50, change: 45.20, changePercent: 5.16 },
            { symbol: 'AMD', price: 175.80, change: 8.30, changePercent: 4.95 },
          ],
          losers: [
            { symbol: 'BABA', price: 78.30, change: -4.50, changePercent: -5.43 },
            { symbol: 'NIO', price: 5.20, change: -0.35, changePercent: -6.31 },
          ],
        },
      }),
    })
  })

  // Stock splits
  await page.route('**/api/market/splits*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { symbol: 'SMCI', ratio: '10:1', exDate: '2026-03-01', payDate: '2026-03-05' },
        ],
      }),
    })
  })
}

// ---------------------------------------------------------------------------
// Calendar Heatmap
// ---------------------------------------------------------------------------

export async function setupCalendarMock(page: Page): Promise<void> {
  await page.route('**/api/members/dashboard/calendar*', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    const days = []
    for (let d = 1; d <= 28; d++) {
      const isWin = d % 3 !== 0
      days.push({
        date: `2026-02-${String(d).padStart(2, '0')}`,
        pnl: isWin ? 50 + (d * 10) : -(30 + (d * 5)),
        trade_count: d % 4 === 0 ? 0 : 2 + (d % 3),
        win_rate: isWin ? 0.67 : 0.33,
        best_trade: isWin ? 120 : null,
        worst_trade: isWin ? null : -80,
        mood: null,
      })
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: days }),
    })
  })
}

// ---------------------------------------------------------------------------
// AI Insights & Market Brief
// ---------------------------------------------------------------------------

export async function setupAIInsightsMocks(page: Page): Promise<void> {
  // AI Coach morning brief
  await page.route('**/api/ai-coach/morning-brief*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          market_status: 'open',
          bias: 'Bullish',
          confidence: 0.72,
          expected_move: 0.8,
          support_levels: [6000, 5980],
          resistance_levels: [6080, 6100],
          events: [
            { time: '10:00 AM', name: 'JOLTS Job Openings', impact: 'HIGH' },
          ],
        },
      }),
    })
  })

  // AI insights from journal
  await page.route('**/api/members/journal/analytics*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          total_trades: 24,
          win_rate: 0.625,
          total_pnl: 1250.75,
          patterns: ['Strong morning session performance', 'SPY trades outperform indices'],
          suggestion: 'Focus on morning setups with SPY.',
        },
      }),
    })
  })

  // Earnings calendar
  await page.route('**/api/ai-coach/earnings*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { symbol: 'AAPL', date: '2026-03-01', expected_move: 3.5, impact: 'HIGH', source: 'mock' },
          { symbol: 'MSFT', date: '2026-03-02', expected_move: 2.8, impact: 'HIGH', source: 'mock' },
        ],
      }),
    })
  })
}

// ---------------------------------------------------------------------------
// All Dashboard Mocks Bundle
// ---------------------------------------------------------------------------

export async function setupAllDashboardMocks(page: Page): Promise<void> {
  await setupDashboardStatsMock(page)
  await setupEquityCurveMock(page)
  await setupRecentTradesMock(page)
  await setupMarketDataMocks(page)
  await setupCalendarMock(page)
  await setupAIInsightsMocks(page)
}
