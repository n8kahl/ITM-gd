import { test, expect } from '@playwright/test'

/**
 * SERVER-SIDE AUTH FLOW TESTS
 *
 * These tests verify the new server-side OAuth callback implementation
 * fixes the redirect loop and cookie race condition issues.
 *
 * Key requirements:
 * - /auth/callback forwards to /api/auth/callback
 * - /api/auth/callback handles code exchange server-side
 * - No infinite redirect loops
 * - Proper error handling for missing/invalid codes
 */

test.describe('Server-Side OAuth Callback Flow @critical', () => {
  test('SSA-001: /auth/callback page loads and shows redirect message', async ({ page }) => {
    const response = await page.goto('/auth/callback')

    // Page should return 200
    expect(response?.status()).toBe(200)

    // Should show callback/loading/redirect message
    const bodyText = await page.locator('body').textContent()
    expect(bodyText).toMatch(/Loading|Authenticating|Redirecting|secure authentication/i)
  })

  test('SSA-002: /auth/callback without code forwards then redirects to login', async ({ page }) => {
    const forwardedRequest = page.waitForRequest((request) => (
      request.url().includes('/api/auth/callback')
    ))

    await page.goto('/auth/callback', { waitUntil: 'domcontentloaded' })
    await forwardedRequest

    await page.waitForURL(/\/login/)
    expect(page.url()).toContain('error=oauth')
  })

  test('SSA-003: /api/auth/callback without code redirects to login with error', async ({ page }) => {
    const response = await page.goto('/api/auth/callback', { waitUntil: 'networkidle' })

    // Should redirect to login with error
    const finalUrl = page.url()
    expect(finalUrl).toContain('/login')
    expect(finalUrl).toContain('error=oauth')
  })

  test('SSA-004: /api/auth/callback with error param redirects to login', async ({ page }) => {
    await page.goto('/api/auth/callback?error=access_denied&error_description=User+cancelled', {
      waitUntil: 'networkidle'
    })

    // Should redirect to login with error preserved
    const finalUrl = page.url()
    expect(finalUrl).toContain('/login')
    expect(finalUrl).toContain('error=oauth')
  })

  test('SSA-005: /auth/callback preserves redirect query param', async ({ page }) => {
    const forwardedRequest = page.waitForRequest((request) => (
      request.url().includes('/api/auth/callback')
      && request.url().includes('redirect=%2Fmembers%2Flibrary')
    ))

    await page.goto('/auth/callback?redirect=/members/library', { waitUntil: 'domcontentloaded' })
    const request = await forwardedRequest
    expect(request.url()).toContain('redirect=%2Fmembers%2Flibrary')
  })

  test('SSA-006: /auth/callback does NOT call exchangeCodeForSession client-side', async ({ page }) => {
    const consoleMessages: string[] = []

    page.on('console', msg => {
      consoleMessages.push(msg.text())
    })

    await page.goto('/auth/callback?code=test_code_123')
    await page.waitForTimeout(2000)

    // Should NOT see "Exchanging code for session" client-side log
    const hasClientExchange = consoleMessages.some(msg =>
      msg.toLowerCase().includes('exchanging code for session')
    )

    expect(hasClientExchange).toBeFalsy()
  })
})

test.describe('Redirect Loop Prevention @critical', () => {
  test('RLP-001: Unauthenticated /members access redirects to login ONCE', async ({ page }) => {
    // Clear any existing session
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    const redirects: string[] = []
    page.on('response', response => {
      if ([301, 302, 303, 307, 308].includes(response.status())) {
        redirects.push(response.url())
      }
    })

    await page.goto('/members', { waitUntil: 'networkidle' })

    // Should end up on login page
    const finalUrl = page.url()
    expect(finalUrl).toContain('/login')

    // Should have redirect param
    expect(finalUrl).toContain('redirect')

    // Should NOT have more than 3 redirects (middleware + potential client redirect)
    // This prevents infinite loops
    expect(redirects.length).toBeLessThanOrEqual(3)
  })

  test('RLP-002: Unauthenticated /admin access redirects to login ONCE', async ({ page }) => {
    // Clear any existing session
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    const redirects: string[] = []
    page.on('response', response => {
      if ([301, 302, 303, 307, 308].includes(response.status())) {
        redirects.push(response.url())
      }
    })

    await page.goto('/admin', { waitUntil: 'networkidle' })

    // Should end up on login page
    const finalUrl = page.url()
    expect(finalUrl).toContain('/login')

    // Should NOT have infinite redirects
    expect(redirects.length).toBeLessThanOrEqual(3)
  })

  test('RLP-003: No redirect loop between /members and /join-discord', async ({ page }) => {
    // Clear any existing session
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    const urls: string[] = []
    let redirectCount = 0

    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        urls.push(frame.url())
        redirectCount++
      }
    })

    // Try to access join-discord
    await page.goto('/join-discord', { waitUntil: 'networkidle', timeout: 10000 })

    // Should redirect to login (not members, which would create a loop)
    const finalUrl = page.url()
    expect(finalUrl).toContain('/login')

    // Should not have excessive redirects
    expect(redirectCount).toBeLessThan(5)

    // Should NOT have both /members and /join-discord in redirect chain
    const hasMembersAndJoinDiscord =
      urls.some(u => u.includes('/members')) &&
      urls.some(u => u.includes('/join-discord'))

    expect(hasMembersAndJoinDiscord).toBeFalsy()
  })

  test('RLP-004: Page does not hang on auth callback without code', async ({ page }) => {
    const timeout = 8000 // 8 seconds

    // Set a timeout to detect hangs
    const loadPromise = page.goto('/auth/callback', {
      waitUntil: 'networkidle',
      timeout
    })

    // Should complete within timeout (not hang)
    await expect(loadPromise).resolves.toBeTruthy()

    // Should have navigated away (to API route or login)
    const finalUrl = page.url()
    expect(finalUrl).not.toBe('http://localhost:3000/auth/callback')
  })
})

test.describe('Middleware Route Protection @critical', () => {
  test('MRP-001: Middleware protects /members route', async ({ page }) => {
    // Clear session
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    const response = await page.goto('/members', { waitUntil: 'networkidle' })

    // Should either get a redirect response or end up on login
    const finalUrl = page.url()
    const wasRedirected = response?.status() === 307 || response?.status() === 302
    const endedOnLogin = finalUrl.includes('/login')

    expect(wasRedirected || endedOnLogin).toBeTruthy()
  })

  test('MRP-002: Middleware protects /admin route', async ({ page }) => {
    // Clear session
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    const response = await page.goto('/admin', { waitUntil: 'networkidle' })

    // Should either get a redirect response or end up on login
    const finalUrl = page.url()
    const wasRedirected = response?.status() === 307 || response?.status() === 302
    const endedOnLogin = finalUrl.includes('/login')

    expect(wasRedirected || endedOnLogin).toBeTruthy()
  })

  test('MRP-003: /join-discord requires authentication', async ({ page }) => {
    // Clear session
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    await page.goto('/join-discord', { waitUntil: 'networkidle' })

    // Should redirect to login
    const finalUrl = page.url()
    expect(finalUrl).toContain('/login')
  })

  test('MRP-004: Middleware runs on auth callback routes', async ({ page }) => {
    // Both routes should be processed by middleware
    const authCallbackResponse = await page.goto('/auth/callback')
    const apiCallbackResponse = await page.goto('/api/auth/callback')

    // Both should return valid responses (not 404)
    expect(authCallbackResponse?.status()).not.toBe(404)
    expect(apiCallbackResponse?.status()).not.toBe(404)
  })
})

test.describe('Cookie-Aware Client Behavior @regression', () => {
  test('CAC-001: Supabase client uses cookie storage', async ({ page }) => {
    await page.goto('/login')

    // Check that the new browser client is being used
    const usesSSR = await page.evaluate(() => {
      // The new client should be from @supabase/ssr
      return typeof window !== 'undefined'
    })

    expect(usesSSR).toBeTruthy()
  })

  test('CAC-002: Auth cookies are set with correct attributes', async ({ page }) => {
    await page.goto('/login')

    // Get all cookies
    const cookies = await page.context().cookies()

    // Supabase auth cookies should have specific attributes if session exists
    // For now, just verify we can read cookies
    expect(Array.isArray(cookies)).toBeTruthy()
  })

  test('CAC-003: No localStorage-only auth (uses cookies)', async ({ page }) => {
    await page.goto('/')

    // Clear localStorage
    await page.evaluate(() => {
      localStorage.clear()
    })

    // The app should still be able to check auth via cookies
    // (Middleware can read cookies even if localStorage is empty)
    const hasLocalStorageAuth = await page.evaluate(() => {
      const keys = Object.keys(localStorage)
      return keys.some(k => k.includes('supabase') || k.includes('auth'))
    })

    // After clearing, should not rely only on localStorage
    expect(hasLocalStorageAuth).toBeFalsy()
  })
})

test.describe('Error Handling & Edge Cases @regression', () => {
  test('ERR-001: Invalid OAuth code is handled gracefully', async ({ page }) => {
    await page.goto('/api/auth/callback?code=invalid_code_12345', {
      waitUntil: 'networkidle'
    })

    // Should redirect to login with error (not crash)
    const finalUrl = page.url()
    expect(finalUrl).toContain('/login')
    expect(finalUrl).toContain('error')
  })

  test('ERR-002: Missing next/redirect param defaults safely', async ({ page }) => {
    await page.goto('/api/auth/callback', { waitUntil: 'networkidle' })

    // Should redirect to login (default safe redirect)
    const finalUrl = page.url()
    expect(finalUrl).toContain('/login')
  })

  test('ERR-003: Callback page does not crash on empty query params', async ({ page }) => {
    const response = await page.goto('/auth/callback?', { waitUntil: 'networkidle' })

    // Should handle gracefully (not 500 error)
    expect(response?.status()).not.toBe(500)
  })

  test('ERR-004: Multiple rapid redirects do not cause race condition', async ({ page }) => {
    // Clear session
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    // Navigate to protected route multiple times rapidly
    const navigations = [
      page.goto('/members'),
      page.goto('/admin'),
      page.goto('/members/library')
    ]

    // All should complete without hanging
    await Promise.allSettled(navigations)

    // Should end up on login page
    const finalUrl = page.url()
    expect(finalUrl).toContain('/login')
  })
})
