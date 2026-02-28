import type { Page, Route } from '@playwright/test'
import { authenticateAsMember } from '../../helpers/member-auth'

const E2E_USER_ID = '00000000-0000-4000-8000-000000000001'

interface MockOptions {
  healthStatus?: number
  includePriorDayBar?: boolean
  corruptSecondTradeTimestamps?: boolean
}

export async function enableTradeDayReplayBypass(page: Page): Promise<void> {
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

export async function setupTradeDayReplayShellMocks(page: Page): Promise<void> {
  await page.route('**/api/config/roles*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  await page.route('**/api/config/tabs*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { tab_id: 'dashboard', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 1, label: 'Dashboard', icon: 'LayoutDashboard', path: '/members' },
          { tab_id: 'trade-day-replay', required_tier: 'admin', is_active: true, is_required: false, mobile_visible: true, sort_order: 2, label: 'Trade Day Replay', icon: 'Play', path: '/members/trade-day-replay' },
          { tab_id: 'profile', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 99, label: 'Profile', icon: 'UserCircle', path: '/members/profile' },
        ],
      }),
    })
  })

  await page.route('**/api/members/admin-status*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        isAdmin: true,
      }),
    })
  })

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
          discord_username: 'ReplayAdmin',
          email: 'replay-admin@example.com',
          membership_tier: 'executive',
          discord_roles: ['role-admin'],
          discord_avatar: null,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      }),
    })
  })
}

function createMockReplayPayload(options: MockOptions = {}) {
  const includePriorDayBar = options.includePriorDayBar ?? true
  const corruptSecondTradeTimestamps = options.corruptSecondTradeTimestamps ?? false
  const sessionStartEpochSeconds = 1_772_202_840 // 2026-02-27T09:34:00-05:00
  const closeSeries = [
    6_849.8,
    6_851.1,
    6_852.7,
    6_853.4,
    6_854.2,
    6_855.9,
    6_857.2,
    6_858.6,
    6_859.9,
    6_861.5,
    6_862.1,
    6_861.7,
    6_860.4,
    6_859.2,
    6_858.6,
    6_858.0,
    6_858.7,
    6_859.8,
    6_860.9,
    6_861.8,
    6_862.4,
    6_863.3,
    6_864.2,
    6_865.1,
    6_865.9,
    6_866.3,
    6_866.8,
  ]
  const bars = closeSeries.map((close, index) => {
    const previousClose = index > 0 ? closeSeries[index - 1]! : close - 0.6
    const open = Number(previousClose.toFixed(2))
    const high = Number((Math.max(open, close) + 0.85).toFixed(2))
    const low = Number((Math.min(open, close) - 0.85).toFixed(2))
    return {
      time: sessionStartEpochSeconds + (index * 60),
      open,
      high,
      low,
      close,
      volume: 1_050 + (index * 32),
    }
  })

  return {
    bars,
    trades: [
      {
        tradeIndex: 1,
        contract: { symbol: 'SPX', strike: 6900, type: 'call', expiry: '2026-02-27' },
        direction: 'long',
        entryPrice: 3.6,
        entryTimestamp: '2026-02-27T09:35:00-05:00',
        exitEvents: [
          { type: 'trim', percentage: 23, timestamp: '2026-02-27T09:40:00-05:00' },
          { type: 'full_exit', timestamp: '2026-02-27T09:47:00-05:00' },
        ],
        stopLevels: [{ spxLevel: 6851, timestamp: '2026-02-27T09:37:00-05:00' }],
        spxReferences: [6850, 6860],
        sizing: 'normal',
        rawMessages: ['PREP SPX 6900C', 'Filled AVG 3.60', 'Fully out'],
        optionsAtEntry: { delta: 0.44, gamma: 0.02, theta: -0.06, vega: 0.18, iv: 0.22, bid: 3.5, ask: 3.7 },
        evaluation: {
          alignmentScore: 82,
          confidence: 77,
          confidenceTrend: 'up',
          expectedValueR: 1.8,
          drivers: ['Post-entry momentum confirmed trade direction.'],
          risks: ['No major deterministic risk flags were detected.'],
        },
        pnlPercent: 34,
        isWinner: true,
        holdDurationMin: 12,
      },
      {
        tradeIndex: 2,
        contract: { symbol: 'SPX', strike: 6895, type: 'call', expiry: '2026-02-27' },
        direction: 'long',
        entryPrice: 4.8,
        entryTimestamp: corruptSecondTradeTimestamps ? 'invalid-trade-timestamp' : '2026-02-27T09:50:00-05:00',
        exitEvents: [{
          type: 'full_exit',
          timestamp: corruptSecondTradeTimestamps ? 'invalid-exit-timestamp' : '2026-02-27T10:00:00-05:00',
        }],
        stopLevels: [{ spxLevel: 6859, timestamp: '2026-02-27T09:53:00-05:00' }],
        spxReferences: [6865],
        sizing: 'light',
        rawMessages: ['PREP SPX 6895C', 'Filled AVG 4.80', 'Fully sold runners'],
        optionsAtEntry: null,
        evaluation: {
          alignmentScore: 68,
          confidence: 65,
          confidenceTrend: 'flat',
          expectedValueR: 0.9,
          drivers: ['Light sizing reduced capital at risk.'],
          risks: ['Post-entry momentum faded shortly after entry.'],
        },
        pnlPercent: 10,
        isWinner: true,
        holdDurationMin: 10,
      },
    ],
    stats: {
      totalTrades: 2,
      winners: 2,
      losers: 0,
      winRate: 100,
      bestTrade: { index: 1, pctReturn: 34 },
      worstTrade: { index: 2, pctReturn: 10 },
      sessionStartET: '2026-02-27 09:35 ET',
      sessionEndET: '2026-02-27 10:00 ET',
      sessionDurationMin: 25,
    },
    ...(includePriorDayBar ? {
      priorDayBar: {
        high: 6867,
        low: 6812,
      },
    } : {}),
  }
}

export async function setupTradeDayReplayApiMocks(page: Page, options: MockOptions = {}): Promise<void> {
  const healthStatus = options.healthStatus ?? 200

  await page.route('**/api/trade-day-replay/health*', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    if (healthStatus === 403) {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'FORBIDDEN', message: 'Admin access required' }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        limits: {
          maxTranscriptChars: 120_000,
          maxParsedTrades: 25,
        },
      }),
    })
  })

  await page.route('**/api/trade-day-replay/build*', async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createMockReplayPayload(options)),
    })
  })
}
