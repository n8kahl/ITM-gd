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

test.describe('AI Coach - Fibonacci levels', () => {
  test('shows Fibonacci levels in chart overlays', async ({ page }) => {
    await authenticateAsMember(page)
    await setupBaselineRoutes(page)
    await page.addInitScript(() => {
      localStorage.setItem('ai-coach-onboarding-complete', 'true')
    })

    await page.goto(AI_COACH_URL)
    await page.waitForLoadState('networkidle')

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ai-coach-show-chart', {
        detail: {
          symbol: 'SPX',
          timeframe: '1D',
          levels: {
            resistance: [{ name: 'PDH', type: 'PDH', price: 5960 }],
            support: [{ name: 'PDL', type: 'PDL', price: 5930 }],
            fibonacci: [
              { name: '0%', price: 6000 },
              { name: '23.6%', price: 5982 },
              { name: '38.2%', price: 5968, isMajor: true },
              { name: '50%', price: 5950 },
              { name: '61.8%', price: 5932, isMajor: true },
              { name: '78.6%', price: 5912 },
              { name: '100%', price: 5890 },
            ],
            indicators: { vwap: 5944, atr14: 48 },
          },
        },
      }))
    })

    await expect(page.locator('text=Fib 61.8%').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Fib 38.2%').first()).toBeVisible()
  })
})
