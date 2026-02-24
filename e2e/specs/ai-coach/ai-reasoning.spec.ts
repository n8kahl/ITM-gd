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

async function setupChatRoutes(page: Page) {
  await page.addInitScript((assistantResponse) => {
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

      if (url.includes('/api/chat/stream')) {
        return jsonResponse({
          error: 'stream_unavailable',
          message: 'Streaming unavailable in mock mode',
        }, 503)
      }

      if (url.includes('/api/chat/message')) {
        return jsonResponse(assistantResponse)
      }

      return originalFetch(input, init)
    }
  }, {
    sessionId: 'session-1',
    messageId: 'assistant-1',
    role: 'assistant',
    content: [
      'SPX is testing PDH at $5,950.25.',
      'PDH tested 3x today (9:45 AM, 11:20 AM, 2:15 PM) with 100% hold rate.',
      'Triple confluence near $5,920 (Fib 61.8%, VWAP, S1).',
      'Invalidates on a 15m close below $5,915.',
      'Nearest resistance is +1.8 ATR from current price.',
    ].join(' '),
    functionCalls: [],
    tokensUsed: 420,
    responseTime: 850,
  })

  await page.route('**/api/chat/sessions*', async (route: Route) => {
    await fulfillJson(route, { sessions: [], count: 0 })
  })

  await page.route('**/api/chat/sessions/*', async (route: Route) => {
    await fulfillJson(route, { messages: [], total: 0, hasMore: false })
  })

  await page.route('**/api/chat/stream', async (route: Route) => {
    await fulfillJson(route, {
      error: 'stream_unavailable',
      message: 'Streaming unavailable in mock mode',
    }, 503)
  })

  await page.route('**/api/chat/message', async (route: Route) => {
    await fulfillJson(route, {
      sessionId: 'session-1',
      messageId: 'assistant-1',
      role: 'assistant',
      content: [
        'SPX is testing PDH at $5,950.25.',
        'PDH tested 3x today (9:45 AM, 11:20 AM, 2:15 PM) with 100% hold rate.',
        'Triple confluence near $5,920 (Fib 61.8%, VWAP, S1).',
        'Invalidates on a 15m close below $5,915.',
        'Nearest resistance is +1.8 ATR from current price.',
      ].join(' '),
      functionCalls: [],
      tokensUsed: 420,
      responseTime: 850,
    })
  })
}

test.describe('AI Coach - reasoning specificity', () => {
  test('renders analysis with test counts, confluence, invalidation, and ATR context', async ({ page }) => {
    await authenticateAsMember(page)
    await setupChatRoutes(page)
    await page.addInitScript(() => {
      localStorage.setItem('ai-coach-onboarding-complete', 'true')
    })

    await page.goto(AI_COACH_URL, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('textarea[aria-label="Message the AI coach"]').first()).toBeVisible()

    await page
      .locator('textarea[aria-label="Message the AI coach"]')
      .first()
      .fill('Analyze SPX')
    await page.locator('button[aria-label="Send message"]').first().click()

    await expect(page.locator('text=tested 3x today').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=Triple confluence near $5,920').first()).toBeVisible()
    await expect(page.locator('text=Invalidates on a 15m close below $5,915').first()).toBeVisible()
    await expect(page.locator('text=+1.8 ATR').first()).toBeVisible()
  })
})
