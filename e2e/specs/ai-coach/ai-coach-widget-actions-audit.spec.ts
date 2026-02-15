import { test, expect, type Locator, type Page, type Route } from '@playwright/test'
import { authenticateAsMember } from '../../helpers/member-auth'

const AI_COACH_URL = '/members/ai-coach'
const SESSION_ID = '550e8400-e29b-41d4-a716-446655440000'

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'Authorization,Content-Type,x-e2e-bypass-auth',
}

async function clickCardAction(
  page: Page,
  card: Locator,
  actionName: RegExp,
) {
  const directAction = card.getByRole('button', { name: actionName }).first()
  if (await directAction.count() > 0 && await directAction.isVisible()) {
    await directAction.click()
    return
  }

  const overflowButton = card.getByRole('button', { name: /More actions/i }).first()
  if (await overflowButton.count() === 0) {
    throw new Error(`Action ${actionName} not found in card and overflow menu is unavailable`)
  }

  await overflowButton.click()
  await page.getByRole('button', { name: actionName }).first().click()
}

async function fulfillJson(route: Route, body: unknown, status: number = 200) {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({
      status: 204,
      headers: CORS_HEADERS,
      body: '',
    })
    return
  }

  await route.fulfill({
    status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

async function setupAICoachActionAuditRoutes(page: Page): Promise<string[]> {
  const capturedMessages: string[] = []

  await page.route('**/api/chat/sessions*', async (route: Route) => {
    const method = route.request().method()
    if (method === 'DELETE') {
      await fulfillJson(route, { success: true })
      return
    }
    await fulfillJson(route, { sessions: [], count: 0 })
  })

  await page.route('**/api/chat/sessions/*', async (route: Route) => {
    await fulfillJson(route, { messages: [], total: 0, hasMore: false })
  })

  // Force fallback to non-streaming path so we can control payload deterministically.
  await page.route('**/api/chat/stream', async (route: Route) => {
    await fulfillJson(route, {
      error: 'stream_unavailable',
      message: 'Streaming unavailable in widget action audit',
    }, 503)
  })

  await page.route('**/api/chat/message', async (route: Route) => {
    const body = route.request().postDataJSON() as { message?: string } | null
    const message = String(body?.message || '')
    capturedMessages.push(message)

    if (message.toLowerCase().includes('beginner prompt')) {
      await fulfillJson(route, {
        sessionId: SESSION_ID,
        messageId: 'assistant-beginner-1',
        role: 'assistant',
        content: 'Beginner mode: Start with risk-first execution and keep position size small.',
        functionCalls: [],
        tokensUsed: 160,
        responseTime: 0.45,
      })
      return
    }

    if (message.toLowerCase().includes('advanced prompt')) {
      await fulfillJson(route, {
        sessionId: SESSION_ID,
        messageId: 'assistant-advanced-1',
        role: 'assistant',
        content: 'Advanced mode: loaded levels, price context, and a position card for workflow actions.',
        functionCalls: [
          {
            function: 'get_key_levels',
            arguments: { symbol: 'SPX' },
            result: {
              symbol: 'SPX',
              currentPrice: 6001.25,
              levels: {
                resistance: [
                  { name: 'PDH', price: 6010.0, type: 'PDH' },
                  { name: 'R1', price: 6022.5, type: 'R1' },
                ],
                support: [
                  { name: 'PDC', price: 5992.0, type: 'PDC' },
                  { name: 'S1', price: 5981.5, type: 'S1' },
                ],
                indicators: {
                  vwap: 6000.1,
                  atr14: 24.4,
                },
              },
            },
          },
          {
            function: 'get_current_price',
            arguments: { symbol: 'AAPL' },
            result: {
              symbol: 'AAPL',
              price: 203.12,
              high: 205.0,
              low: 201.8,
              isDelayed: false,
              priceAsOf: '15:55 ET',
            },
          },
          {
            function: 'analyze_position',
            arguments: { position: { symbol: 'NVDA', type: 'call', strike: 900, quantity: 1 } },
            result: {
              position: {
                symbol: 'NVDA',
                type: 'call',
                strike: 900,
                expiry: '2026-02-20',
                quantity: 1,
                entryPrice: 15.4,
                entryDate: '2026-02-10',
              },
              pnl: 245.5,
              pnlPct: 18.2,
              currentValue: 1595.5,
              greeks: {
                delta: 0.41,
                gamma: 0.02,
                theta: -12.4,
                vega: 22.6,
              },
            },
          },
          {
            function: 'scan_opportunities',
            arguments: { symbols: ['SPX', 'AAPL'] },
            result: {
              opportunities: [
                {
                  id: 'scan-1',
                  type: 'technical',
                  setupType: 'breakout',
                  symbol: 'SPX',
                  direction: 'bullish',
                  score: 82,
                  confidence: 0.79,
                  currentPrice: 6001.25,
                  description: 'Momentum continuation above opening range high.',
                  suggestedTrade: {
                    strategy: 'Long call',
                    entry: 6003,
                    stopLoss: 5994,
                    target: 6018,
                    expiry: '2026-02-20',
                  },
                  metadata: {},
                  scannedAt: new Date().toISOString(),
                },
              ],
              count: 1,
            },
          },
        ],
        tokensUsed: 820,
        responseTime: 1.02,
      })
      return
    }

    if (message.includes('Summarize SPX key levels')) {
      await fulfillJson(route, {
        sessionId: SESSION_ID,
        messageId: 'assistant-followup-1',
        role: 'assistant',
        content: 'Follow-up audit response: SPX key levels summarized.',
        functionCalls: [],
        tokensUsed: 180,
        responseTime: 0.35,
      })
      return
    }

    await fulfillJson(route, {
      sessionId: SESSION_ID,
      messageId: 'assistant-default-1',
      role: 'assistant',
      content: 'Default mocked response.',
      functionCalls: [],
      tokensUsed: 120,
      responseTime: 0.2,
    })
  })

  await page.route('**/api/chart/**', async (route: Route) => {
    await fulfillJson(route, {
      symbol: 'SPX',
      timeframe: '1D',
      bars: [
        { time: 1739318400, open: 5990, high: 6020, low: 5980, close: 6000, volume: 100000 },
        { time: 1739404800, open: 6000, high: 6030, low: 5992, close: 6001.25, volume: 120000 },
      ],
      count: 2,
      timestamp: new Date().toISOString(),
      cached: true,
    })
  })

  await page.route('**/api/options/**/chain**', async (route: Route) => {
    await fulfillJson(route, {
      symbol: 'SPX',
      currentPrice: 6001.25,
      expiry: '2026-02-20',
      daysToExpiry: 9,
      ivRank: 46,
      options: {
        calls: [],
        puts: [],
      },
    })
  })

  await page.route('**/api/options/**/expirations**', async (route: Route) => {
    await fulfillJson(route, {
      symbol: 'SPX',
      expirations: ['2026-02-20', '2026-02-27'],
      count: 2,
    })
  })

  await page.route('**/api/alerts**', async (route: Route) => {
    const method = route.request().method()
    if (method === 'POST') {
      await fulfillJson(route, {
        success: true,
        alert: {
          id: 'alert-1',
          symbol: 'AAPL',
          target: 203.12,
          status: 'active',
        },
      })
      return
    }
    await fulfillJson(route, { alerts: [] })
  })

  await page.route('**/api/positions/live', async (route: Route) => {
    await fulfillJson(route, {
      positions: [],
      count: 0,
      timestamp: new Date().toISOString(),
    })
  })

  await page.route('**/api/positions/advice**', async (route: Route) => {
    await fulfillJson(route, {
      advice: [],
      count: 0,
      generatedAt: new Date().toISOString(),
    })
  })

  await page.route('**/api/watchlist**', async (route: Route) => {
    await fulfillJson(route, {
      watchlists: [],
      defaultWatchlist: null,
    })
  })

  return capturedMessages
}

test.describe('AI Coach - widget action center audit', () => {
  test('audits beginner + advanced prompts and verifies widget actions drive center views', async ({ page }) => {
    await authenticateAsMember(page)
    const capturedMessages = await setupAICoachActionAuditRoutes(page)

    await page.addInitScript(() => {
      localStorage.setItem('ai-coach-onboarding-complete', 'true')
    })

    await page.goto(AI_COACH_URL)
    await page.waitForLoadState('networkidle')

    const chatInput = page.locator('textarea[aria-label="Message the AI coach"]').first()
    const sendButton = page.locator('button[aria-label="Send message"]').first()

    await chatInput.fill('Beginner prompt: I am brand new to day trading.')
    await sendButton.click()
    await expect(
      page.getByText('Beginner mode: Start with risk-first execution and keep position size small.').first(),
    ).toBeVisible()

    await chatInput.fill('Advanced prompt: give me full workflow cards and actions.')
    await sendButton.click()

    const keyLevelsCard = page.locator('div.glass-card-heavy', { hasText: 'SPX Key Levels' }).first()
    const currentPriceCard = page.locator('div.glass-card-heavy', { hasText: 'AAPL' }).first()
    const positionCard = page.locator('div.glass-card-heavy', { hasText: 'NVDA CALL' }).first()
    const scanResultsCard = page.locator('div.glass-card-heavy', { hasText: 'Scan Results' }).first()

    await expect(keyLevelsCard).toBeVisible()
    await expect(currentPriceCard).toBeVisible()
    await expect(positionCard).toBeVisible()
    await expect(scanResultsCard).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Chart' })).toHaveAttribute('aria-selected', 'true')

    await keyLevelsCard.getByRole('button', { name: /Show on Chart/i }).first().click()
    await expect(page.getByRole('tab', { name: 'Chart' })).toHaveAttribute('aria-selected', 'true')

    await keyLevelsCard.getByRole('button', { name: /View Options/i }).first().click()
    await expect(page.getByRole('tab', { name: 'Options' })).toHaveAttribute('aria-selected', 'true')

    await keyLevelsCard.click()
    await expect(page.getByRole('tab', { name: 'Chart' })).toHaveAttribute('aria-selected', 'true')

    await scanResultsCard.getByRole('button', { name: /Open SPX breakout setup on chart/i }).first().click()
    await expect(page.getByRole('tab', { name: 'Chart' })).toHaveAttribute('aria-selected', 'true')

    await currentPriceCard.getByRole('button', { name: /Set Alert/i }).first().click()
    await expect(page.getByRole('tab', { name: 'Alerts' })).toHaveAttribute('aria-selected', 'true')

    await positionCard.getByRole('button', { name: /^Analyze$/i }).first().click()
    await expect(page.getByRole('tab', { name: 'Positions' })).toHaveAttribute('aria-selected', 'true')

    await clickCardAction(page, keyLevelsCard, /^Ask AI$/i)
    await expect(
      page.getByText('Follow-up audit response: SPX key levels summarized.').first(),
    ).toBeVisible()

    expect(capturedMessages.some((message) => message.includes('Beginner prompt'))).toBe(true)
    expect(capturedMessages.some((message) => message.includes('Advanced prompt'))).toBe(true)
    expect(capturedMessages.some((message) => message.includes('Summarize SPX key levels'))).toBe(true)
  })
})
