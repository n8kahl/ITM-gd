import { test, expect, type Page, type Route } from '@playwright/test'
import { authenticateAsMember } from '../../helpers/member-auth'

const AI_COACH_URL = '/members/ai-coach'
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'Authorization,Content-Type,x-e2e-bypass-auth',
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

async function setupBaselineRoutes(page: Page) {
  await page.addInitScript((chartResponse) => {
    const originalFetch = window.fetch.bind(window)
    const jsonResponse = (body: unknown, status = 200) => new Response(
      JSON.stringify(body),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      },
    )

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : undefined
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
      const method = (init?.method || request?.method || 'GET').toUpperCase()

      if (url.includes('/api/chat/sessions/')) {
        return jsonResponse({ messages: [], total: 0, hasMore: false })
      }

      if (url.includes('/api/chat/sessions')) {
        if (method === 'DELETE') return jsonResponse({ success: true })
        return jsonResponse({ sessions: [], count: 0 })
      }

      if (url.includes('/api/chart/')) {
        return jsonResponse(chartResponse)
      }

      return originalFetch(input, init)
    }
  }, {
    symbol: 'SPX',
    timeframe: '1D',
    bars: [
      { time: 1770748200, open: 5940, high: 5960, low: 5930, close: 5950, volume: 1000000 },
      { time: 1770751800, open: 5950, high: 5965, low: 5945, close: 5958, volume: 1100000 },
    ],
    count: 2,
    timestamp: new Date().toISOString(),
    cached: false,
  })

  await page.route('**/api/chat/sessions*', async (route: Route) => {
    await fulfillJson(route, { sessions: [], count: 0 })
  })

  await page.route('**/api/chat/sessions/*', async (route: Route) => {
    await fulfillJson(route, { messages: [], total: 0, hasMore: false })
  })

  await page.route('**/api/chart/**', async (route: Route) => {
    await fulfillJson(route, {
      symbol: 'SPX',
      timeframe: '1D',
      bars: [
        { time: 1770748200, open: 5940, high: 5960, low: 5930, close: 5950, volume: 1000000 },
        { time: 1770751800, open: 5950, high: 5965, low: 5945, close: 5958, volume: 1100000 },
      ],
      count: 2,
      timestamp: new Date().toISOString(),
      cached: false,
    })
  })
}

test.describe('AI Coach - Chart labels', () => {
  test('renders enriched level labels with context and test counts', async ({ page }) => {
    await authenticateAsMember(page)
    await setupBaselineRoutes(page)
    await page.addInitScript(() => {
      localStorage.setItem('ai-coach-onboarding-complete', 'true')
    })

    await page.goto(AI_COACH_URL, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('tab', { name: 'Chart' })).toBeVisible()

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ai-coach-show-chart', {
        detail: {
          symbol: 'SPX',
          timeframe: '1D',
          levels: {
            resistance: [
              {
                name: 'PDH',
                type: 'PDH',
                price: 5960.25,
                displayLabel: 'PDH $5,960.25',
                displayContext: '↑ +0.40% / +0.8 ATR',
                testsToday: 3,
                holdRate: 1,
                lastTest: '2026-02-10T14:15:00.000Z',
                strength: 'critical',
              },
            ],
            support: [
              {
                name: 'VWAP',
                type: 'VWAP',
                price: 5940.5,
                displayLabel: 'VWAP $5,940.50',
                displayContext: '↓ -0.12% / -0.2 ATR',
                testsToday: 1,
                holdRate: 1,
                lastTest: '2026-02-10T13:45:00.000Z',
                strength: 'dynamic',
              },
            ],
            indicators: { vwap: 5940.5, atr14: 48 },
          },
        },
      }))
    })

    await expect(page.locator('text=PDH $5,960.25').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=↑ +0.40% / +0.8 ATR').first()).toBeVisible()
    await expect(page.locator('text=Tested 3x').first()).toBeVisible()
  })
})
