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
    await page.goto('/auth/callback', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)

    const bodyText = await page.locator('body').textContent()
    const hasLoadingCopy = /Loading|Processing|Authenticating|Redirecting|secure authentication/i.test(bodyText || '')
    const redirectedToLogin = page.url().includes('/login')

    expect(hasLoadingCopy || redirectedToLogin).toBeTruthy()
  })

  test('forwards to server-side API route', async ({ page }) => {
    const forwardedRequest = page.waitForRequest((request) => (
      request.url().includes('/api/auth/callback')
    ))

    await page.goto('/auth/callback?code=test123', { waitUntil: 'domcontentloaded' })

    const request = await forwardedRequest
    expect(request.url()).toContain('code=test123')

    await page.waitForURL(/\/login/)
    expect(page.url()).toContain('error=oauth')
  })

  test('preserves query parameters when forwarding', async ({ page }) => {
    const forwardedRequest = page.waitForRequest((request) => (
      request.url().includes('/api/auth/callback')
      && request.url().includes('redirect=%2Fmembers%2Flibrary')
    ))

    await page.goto('/auth/callback?code=abc123&redirect=/members/library&state=xyz', {
      waitUntil: 'domcontentloaded',
    })

    const request = await forwardedRequest
    expect(request.url()).toContain('code=abc123')
    expect(request.url()).toContain('state=xyz')
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

    // Callback route may briefly show forwarding copy before it lands on login.
    expect(bodyText).toMatch(/Redirecting|secure authentication|Welcome Back|Authentication Failed/i)
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
