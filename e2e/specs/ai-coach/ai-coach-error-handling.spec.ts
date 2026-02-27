import { test, expect } from '@playwright/test'
import {
  enableBypass,
  setupOnboarding,
  setupShellMocks,
  setupChatMocks,
  setupChartMocks,
  setupOptionsMocks,
  setupPositionsMocks,
  setupMiscMocks,
  navigateToAICoach,
  waitForChatReady,
  sendChatMessage,
} from './ai-coach-test-helpers'

test.describe.configure({ mode: 'serial' })

test.describe('AI Coach — Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableBypass(page)
    await setupOnboarding(page, { complete: true })
    await setupShellMocks(page)
    await setupChartMocks(page)
    await setupOptionsMocks(page)
    await setupPositionsMocks(page)
    await setupMiscMocks(page)
  })

  test('should display error banner on API failure', async ({ page }) => {
    // Setup chat mocks with default success endpoint
    await setupChatMocks(page, { responseOverride: 'Test response' })

    // Navigate to AI Coach
    await navigateToAICoach(page)
    await waitForChatReady(page)

    // Unroute the chat message endpoint and set it to fail
    await page.unroute('**/api/chat/message')
    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    // Send a message that will fail
    await sendChatMessage(page, 'Analyze SPX')

    // Verify error banner is visible with error icon
    const errorBanner = page.locator('[role="alert"], .error-banner, [class*="error"]').first()
    await expect(errorBanner).toBeVisible({ timeout: 10000 })

    // Verify error message contains relevant text
    const bannerText = await errorBanner.textContent()
    expect(bannerText).toBeTruthy()
    expect(bannerText?.toLowerCase() || '').toMatch(/error|fail|unable/)
  })

  test('should dismiss error banner', async ({ page }) => {
    // Setup chat mocks with default success endpoint
    await setupChatMocks(page, { responseOverride: 'Test response' })

    // Navigate to AI Coach
    await navigateToAICoach(page)
    await waitForChatReady(page)

    // Setup chat message to fail
    await page.unroute('**/api/chat/message')
    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    // Send a message that will fail
    await sendChatMessage(page, 'Analyze SPX')

    // Wait for error banner to appear
    const errorBanner = page.locator('[role="alert"], .error-banner, [class*="error"]').first()
    await expect(errorBanner).toBeVisible({ timeout: 10000 })

    // Find and click the dismiss/close button (X button)
    const closeButton = errorBanner.locator('button[aria-label*="close" i], button[aria-label*="dismiss" i], [class*="close"]').first()
    const xButton = page.locator('button:has-text("×"), button:has-text("✕")').first()

    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click()
    } else if (await xButton.isVisible().catch(() => false)) {
      await xButton.click()
    } else {
      // Try clicking anywhere on the alert to dismiss if it's dismissible
      await errorBanner.click({ force: true })
    }

    // Verify error banner is no longer visible
    await expect(errorBanner).not.toBeVisible({ timeout: 5000 })
  })

  test('should show rate limit banner', async ({ page }) => {
    // Setup chat mocks with default success endpoint
    await setupChatMocks(page, { responseOverride: 'Test response' })

    // Navigate to AI Coach
    await navigateToAICoach(page)
    await waitForChatReady(page)

    // Setup chat message to return 429 rate limit
    await page.unroute('**/api/chat/message')
    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Too many requests',
          queryCount: 45,
          queryLimit: 50,
          retryAfter: 60,
        }),
        headers: {
          'Retry-After': '60',
        },
      })
    })

    // Send a message that will hit rate limit
    await sendChatMessage(page, 'Analyze SPX')

    // Verify rate limit banner is visible (amber/warning color)
    const rateLimitBanner = page.locator('[class*="rate"], [class*="limit"], [role="alert"]').filter({ hasText: /query|limit|rate/i }).first()
    await expect.poll(
      async () => {
        const visible = await rateLimitBanner.isVisible().catch(() => false)
        const text = await rateLimitBanner.textContent().catch(() => '')
        return visible && (text?.includes('45') || text?.includes('50') || text?.toLowerCase().includes('rate'))
      },
      { timeout: 10000 },
    ).toBeTruthy()

    // Verify the banner contains query count and limit information
    const bannerText = await rateLimitBanner.textContent()
    expect(bannerText).toMatch(/\d+/)
  })

  test('should fallback to non-streaming on stream error', async ({ page }) => {
    // Setup chat mocks with streaming disabled (returns 503)
    await setupChatMocks(page, { streamEnabled: false, responseOverride: 'Fallback response from non-stream endpoint' })

    // Navigate to AI Coach
    await navigateToAICoach(page)
    await waitForChatReady(page)

    // Ensure the stream endpoint returns 503
    await page.unroute('**/api/chat/stream')
    await page.route('**/api/chat/stream', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service unavailable' }),
      })
    })

    // Send a message
    await sendChatMessage(page, 'Analyze SPX')

    // Verify assistant response is displayed (fallback to non-streaming worked)
    const assistantMessage = page.locator('[data-role="assistant"], .message-bubble-assistant, [class*="assistant"]').filter({ hasText: /response|fallback/i }).first()
    await expect.poll(
      async () => {
        return await assistantMessage.isVisible().catch(() => false)
      },
      { timeout: 15000 },
    ).toBeTruthy()

    // Verify the fallback response text is visible
    await expect(assistantMessage).toContainText('Fallback response', { ignoreCase: true })
  })

  test('should handle network timeout gracefully', async ({ page }) => {
    // Setup chat mocks with default success endpoint
    await setupChatMocks(page, { responseOverride: 'Test response' })

    // Navigate to AI Coach
    await navigateToAICoach(page)
    await waitForChatReady(page)

    // Setup chat message to delay significantly (timeout)
    await page.unroute('**/api/chat/message')
    await page.route('**/api/chat/message', async (route) => {
      // Delay longer than typical timeout
      await new Promise(resolve => setTimeout(resolve, 35000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: 'This took too long' }),
      })
    })

    // Send a message
    const input = page.locator('textarea, input[type="text"]').first()
    await input.fill('Analyze SPX')
    const sendButton = page.getByRole('button', { name: /send/i })
    await sendButton.click()

    // Wait briefly for loading state
    await page.waitForTimeout(1000)

    // Verify UI shows loading state (spinner, disabled input, etc.)
    const loadingState = page.locator('.loading, [class*="spinner"], [class*="skeleton"], [aria-busy="true"]').first()
    const isLoadingVisible = await loadingState.isVisible({ timeout: 5000 }).catch(() => false)
    const isInputDisabled = !(await input.isEnabled().catch(() => true))

    // Either loading indicator OR disabled input indicates handling gracefully
    expect(isLoadingVisible || isInputDisabled).toBeTruthy()

    // Verify page doesn't crash (we can still interact with it)
    const header = page.locator('header, nav, [class*="header"]').first()
    await expect(header).toBeVisible({ timeout: 5000 })
  })

  test('should recover from error and send again', async ({ page }) => {
    // Setup chat mocks with default success endpoint
    await setupChatMocks(page, { responseOverride: 'Success response' })

    // Navigate to AI Coach
    await navigateToAICoach(page)
    await waitForChatReady(page)

    // Setup chat message to fail initially
    await page.unroute('**/api/chat/message')
    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    // Send first message that will fail
    await sendChatMessage(page, 'First message')

    // Wait for error banner
    const errorBanner = page.locator('[role="alert"], .error-banner, [class*="error"]').first()
    await expect(errorBanner).toBeVisible({ timeout: 10000 })

    // Dismiss error banner
    const closeButton = errorBanner.locator('button[aria-label*="close" i], button[aria-label*="dismiss" i], [class*="close"]').first()
    const xButton = page.locator('button:has-text("×"), button:has-text("✕")').first()

    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click()
    } else if (await xButton.isVisible().catch(() => false)) {
      await xButton.click()
    }

    // Now setup the endpoint to succeed
    await page.unroute('**/api/chat/message')
    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: 'Success response after recovery',
          session_id: 'session-001',
          message_id: `msg-${Date.now()}`,
        }),
      })
    })

    // Send second message with working endpoint
    await sendChatMessage(page, 'Second message')

    // Verify success response is displayed
    const assistantMessage = page.locator('[data-role="assistant"], .message-bubble-assistant, [class*="assistant"]').filter({ hasText: /success/i }).first()
    await expect.poll(
      async () => {
        return await assistantMessage.isVisible().catch(() => false)
      },
      { timeout: 15000 },
    ).toBeTruthy()

    // Verify the recovery response text is visible
    await expect(assistantMessage).toContainText('Success response', { ignoreCase: true })
  })

  test('should handle malformed API response', async ({ page }) => {
    // Setup chat mocks with default success endpoint
    await setupChatMocks(page, { responseOverride: 'Test response' })

    // Navigate to AI Coach
    await navigateToAICoach(page)
    await waitForChatReady(page)

    // Setup chat message to return invalid JSON
    await page.unroute('**/api/chat/message')
    await page.route('**/api/chat/message', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{this is not valid json at all}',
      })
    })

    // Send a message
    await sendChatMessage(page, 'Analyze SPX')

    // Verify error banner appears for malformed response
    const errorBanner = page.locator('[role="alert"], .error-banner, [class*="error"]').first()
    await expect.poll(
      async () => {
        return await errorBanner.isVisible().catch(() => false)
      },
      { timeout: 10000 },
    ).toBeTruthy()

    // Verify error message indicates parsing or response issue
    const bannerText = await errorBanner.textContent()
    expect(bannerText).toBeTruthy()
  })
})
