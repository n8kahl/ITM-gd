import { test, expect } from '@playwright/test'

/**
 * AUTH CALLBACK PAGE TESTS (Client-Side Forwarder)
 *
 * Updated for server-side OAuth flow.
 * The /auth/callback page now immediately forwards to /api/auth/callback
 * instead of handling code exchange client-side.
 */

test.describe('Auth Callback Page (Client Forwarder)', () => {
  test('shows loading/redirect state', async ({ page }) => {
    await page.goto('/auth/callback')

    // The page should show loading/redirect message
    const hasLoadingText = await page.getByText(/Loading|Processing|Authenticating|Redirecting|secure authentication/i).isVisible().catch(() => false)
    const hasSpinner = await page.locator('[class*="animate-spin"], [class*="animate-pulse"]').isVisible().catch(() => false)

    expect(hasLoadingText || hasSpinner).toBeTruthy()
  })

  test('forwards to server-side API route', async ({ page }) => {
    const navigations: string[] = []

    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        navigations.push(frame.url())
      }
    })

    await page.goto('/auth/callback?code=test123')

    // Wait for client-side redirect
    await page.waitForTimeout(2000)

    // Should have navigated to /api/auth/callback
    const hasApiRedirect = navigations.some(url => url.includes('/api/auth/callback'))
    expect(hasApiRedirect).toBeTruthy()
  })

  test('preserves query parameters when forwarding', async ({ page }) => {
    const navigations: string[] = []

    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        navigations.push(frame.url())
      }
    })

    await page.goto('/auth/callback?code=abc123&redirect=/members/library&state=xyz')

    await page.waitForTimeout(2000)

    // API route URL should contain query params
    const apiUrl = navigations.find(url => url.includes('/api/auth/callback'))
    expect(apiUrl).toContain('code=abc123')
    expect(apiUrl).toContain('redirect')
  })

  test('does NOT perform client-side code exchange', async ({ page }) => {
    const consoleMessages: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'info') {
        consoleMessages.push(msg.text())
      }
    })

    await page.goto('/auth/callback?code=test_code')
    await page.waitForTimeout(1500)

    // Should NOT see client-side exchange logs
    const hasExchangeLog = consoleMessages.some(msg =>
      msg.toLowerCase().includes('exchanging code for session') ||
      msg.toLowerCase().includes('code exchange')
    )

    expect(hasExchangeLog).toBeFalsy()
  })

  test('shows correct UI copy for forwarding', async ({ page }) => {
    await page.goto('/auth/callback')
    await page.waitForTimeout(500)

    const bodyText = await page.locator('body').textContent()

    // Should mention redirecting to secure authentication
    expect(bodyText).toMatch(/Redirecting|secure authentication|verify/i)
  })

  test('loads quickly without delays', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/auth/callback')

    // Wait for initial content
    await page.waitForSelector('h1, .animate-spin', { timeout: 5000 })

    const loadTime = Date.now() - startTime

    // Should load very quickly (< 3 seconds)
    expect(loadTime).toBeLessThan(3000)
  })
})
