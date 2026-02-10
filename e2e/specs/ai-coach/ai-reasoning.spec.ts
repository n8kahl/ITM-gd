import { test, expect, type Page, type Route } from '@playwright/test'
import { authenticateAsMember } from '../../helpers/member-auth'

const AI_COACH_URL = '/members/ai-coach'

async function setupChatRoutes(page: Page) {
  await page.route('**/api/chat/sessions*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sessions: [], count: 0 }),
    })
  })

  await page.route('**/api/chat/sessions/*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [], total: 0, hasMore: false }),
    })
  })

  await page.route('**/api/chat/message', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
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
      }),
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

    await page.goto(AI_COACH_URL)
    await page.waitForLoadState('networkidle')

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
