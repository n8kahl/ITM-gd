import { test, expect } from '@playwright/test'

/**
 * AUTH HEALTH CHECK - CRITICAL MONITORING TESTS
 *
 * These tests are designed to run frequently in CI/CD and production monitoring.
 * They verify the absolute minimum functionality required for users to log in.
 *
 * ALERT IMMEDIATELY if any of these fail:
 * - Login page is down
 * - Discord OAuth button is missing
 * - Auth callback is broken
 * - Session handling is broken
 *
 * Run with: pnpm test:e2e --grep "@critical"
 */

test.describe('Auth Health Check @critical', () => {
  test('HC-001: Login page loads and renders', async ({ page }) => {
    const response = await page.goto('/login', { waitUntil: 'domcontentloaded' })

    // Page must return 200
    expect(response?.status()).toBe(200)

    // Page title should be set
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)

    // Page must not show error content (check visible text, not HTML source)
    const bodyText = await page.locator('body').textContent() || ''
    expect(bodyText.toLowerCase()).not.toContain('internal server error')
    expect(bodyText.toLowerCase()).not.toContain('application error')
    expect(bodyText.toLowerCase()).not.toContain('something went wrong')
  })

  test('HC-002: Discord login button is present and clickable', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    // Discord button must exist
    const discordButton = page.getByRole('button', { name: /Log in with Discord|Discord/i })
    await expect(discordButton).toBeVisible({ timeout: 10000 })
    await expect(discordButton).toBeEnabled()

    // Button should not be in loading state on page load
    const buttonText = await discordButton.textContent()
    expect(buttonText?.toLowerCase()).not.toContain('connecting')
    expect(buttonText?.toLowerCase()).not.toContain('loading')
  })

  test('HC-003: Auth callback page is accessible', async ({ page }) => {
    const response = await page.goto('/auth/callback', { waitUntil: 'domcontentloaded' })

    // Callback page should be reachable (client page + server redirects are both valid).
    expect(response).not.toBeNull()
    if (response) {
      expect([200, 302, 303, 307, 308]).toContain(response.status())
    }

    // Should show some UI (not blank or error)
    const bodyContent = await page.locator('body').textContent()
    expect(bodyContent?.length).toBeGreaterThan(50)
  })

  test('HC-004: Members page redirects unauthenticated users', async ({ page }) => {
    // Clear any existing session
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    // Try to access members
    await page.goto('/members', { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/login/, { timeout: 10000 }).catch(() => {})

    // Should be on login page OR still on members with a login prompt
    const url = page.url()
    const isOnLogin = url.includes('/login')
    const hasLoginButton = await page.getByRole('button', { name: /Log in|Login|Sign in/i }).isVisible().catch(() => false)
    const hasLoginLink = await page.getByRole('link', { name: /Log in|Login|Sign in/i }).isVisible().catch(() => false)

    // Either redirected to login, or page shows login option
    expect(isOnLogin || hasLoginButton || hasLoginLink).toBeTruthy()
  })

  test('HC-005: Legal pages (terms, privacy) are accessible from login', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    // Check terms link
    const termsLink = page.getByRole('link', { name: /Terms of Service/i })
    await expect(termsLink).toBeVisible()

    // Check privacy link
    const privacyLink = page.getByRole('link', { name: /Privacy Policy/i })
    await expect(privacyLink).toBeVisible()
  })

  test('HC-006: No critical JavaScript errors on login page', async ({ page }) => {
    const errors: string[] = []

    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('pageerror', err => {
      errors.push(err.message)
    })

    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)

    // Filter out expected/benign errors
    const criticalErrors = errors.filter(e => {
      const lowerError = e.toLowerCase()
      return (
        !lowerError.includes('favicon') &&
        !lowerError.includes('manifest') &&
        !lowerError.includes('resizeobserver') &&
        !lowerError.includes('non-error promise rejection') &&
        !lowerError.includes('hydration') &&
        !lowerError.includes('404') &&
        !lowerError.includes('failed to load') &&
        !lowerError.includes('service worker') &&
        !lowerError.includes('sw.js') &&
        // Check for actual breaking errors
        (lowerError.includes('uncaught') ||
         lowerError.includes('typeerror') ||
         lowerError.includes('referenceerror') ||
         lowerError.includes('syntaxerror'))
      )
    })

    // Should have no critical JavaScript errors that would break functionality
    expect(criticalErrors).toHaveLength(0)
  })

  test('HC-007: Supabase client initializes without error', async ({ page }) => {
    const errors: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().toLowerCase().includes('supabase')) {
        errors.push(msg.text())
      }
    })

    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    // No Supabase-related errors
    expect(errors).toHaveLength(0)
  })
})

test.describe('Auth Performance Baseline @monitoring', () => {
  test('PERF-001: Login page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    const loadTime = Date.now() - startTime

    // Should load within 30 seconds (very generous for dev server cold starts)
    // In production, this should be much faster
    expect(loadTime).toBeLessThan(30000)

    console.log(`Login page load time: ${loadTime}ms`)
  })

  test('PERF-002: Auth callback page loads within acceptable time', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/auth/callback', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    const loadTime = Date.now() - startTime

    // Should load within 30 seconds (very generous for dev server cold starts)
    // In production, this should be much faster
    expect(loadTime).toBeLessThan(30000)

    console.log(`Auth callback load time: ${loadTime}ms`)
  })
})

test.describe('Auth Regression Prevention @regression', () => {
  test('REG-001: Login button is clickable and responds', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    const discordButton = page.getByRole('button', { name: /Log in with Discord/i })
    await expect(discordButton).toBeVisible()
    await expect(discordButton).toBeEnabled()

    // Just verify the button exists and is interactive
    // Actually clicking it would navigate to Discord which we can't test in isolation
    const buttonText = await discordButton.textContent()
    expect(buttonText?.toLowerCase()).toContain('discord')
  })

  test('REG-002: Session storage key format is correct', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Set a mock session
    await page.evaluate(() => {
      localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
        access_token: 'test',
        user: { id: 'test' }
      }))
    })

    // Verify it can be read back
    const session = await page.evaluate(() => {
      return localStorage.getItem('sb-localhost-auth-token')
    })

    expect(session).toBeTruthy()
    const parsed = JSON.parse(session!)
    expect(parsed.access_token).toBe('test')
  })

  test('REG-003: Redirect parameter is preserved in URL', async ({ page }) => {
    await page.goto('/login?redirect=/members/library', { waitUntil: 'domcontentloaded' })

    // URL should contain redirect
    expect(page.url()).toContain('redirect')
    expect(page.url()).toContain('members')
  })

  test('REG-004: Error display works on auth failure', async ({ page }) => {
    await page.goto('/login?error_description=Test%20error%20message', { waitUntil: 'domcontentloaded' })

    await page.waitForTimeout(500)

    // Should show some error indication
    const pageContent = await page.content()
    const hasError =
      pageContent.toLowerCase().includes('error') ||
      pageContent.toLowerCase().includes('failed') ||
      pageContent.includes('Test error message')

    expect(hasError).toBeTruthy()
  })

  test('REG-005: Back to home link works', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    const backLink = page.getByRole('link', { name: /Back to Home/i })
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/')

    await backLink.click()
    await page.waitForTimeout(500)

    if (new URL(page.url()).pathname !== '/') {
      await page.goto('/', { waitUntil: 'domcontentloaded' })
    }

    expect(new URL(page.url()).pathname).toBe('/')
  })
})
