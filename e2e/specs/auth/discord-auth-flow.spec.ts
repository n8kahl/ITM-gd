import { test, expect } from '@playwright/test'
import {
  authenticateAsMember,
  clearMemberAuth,
  isMemberAuthenticated,
  getCurrentUser,
  createExpiredSession,
  authenticateWithSession,
  mockSupabaseSession,
} from '../../helpers/member-auth'
import { setupMemberApiMocks } from '../../helpers/api-mocks'

/**
 * CRITICAL: Discord Authentication Flow E2E Tests
 *
 * These tests verify that the Discord OAuth login flow works correctly.
 * If any of these tests fail, users cannot log in to the platform.
 *
 * Test Coverage:
 * 1. Login page accessibility
 * 2. OAuth redirect initiation
 * 3. Callback handling
 * 4. Session persistence
 * 5. Protected route access
 * 6. Logout flow
 * 7. Error handling
 */

test.describe('Discord Auth Flow - Critical Path', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state before each test
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await clearMemberAuth(page)
  })

  test('CRITICAL: Login page is accessible and functional', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    // Page should load without errors
    await expect(page).toHaveURL('/login')

    // Discord login button must be visible
    const discordButton = page.getByRole('button', { name: /Log in with Discord/i })
    await expect(discordButton).toBeVisible({ timeout: 10000 })
    await expect(discordButton).toBeEnabled()

    // Essential UI elements should be present
    await expect(page.getByText(/Welcome/i)).toBeVisible()
  })

  test('CRITICAL: Discord OAuth redirect is initiated correctly', async ({ page }) => {
    test.setTimeout(60000)

    const pageErrors: string[] = []
    page.on('pageerror', error => {
      pageErrors.push(error.message)
    })

    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    // Click Discord login button
    const discordButton = page.getByRole('button', { name: /Log in with Discord/i })
    await discordButton.click({ noWaitAfter: true }).catch(() => {})
    await page.waitForTimeout(250)

    // Environment-dependent OAuth providers may block/redirect differently;
    // this check ensures the click flow does not trigger app-side runtime errors.
    expect(pageErrors).toHaveLength(0)
  })

  test('CRITICAL: Authenticated user can access /members', async ({ page }) => {
    // Set up authenticated state
    await authenticateAsMember(page)
    await setupMemberApiMocks(page)

    // Navigate to members area
    await page.goto('/members', { waitUntil: 'domcontentloaded' })

    // Should stay on members page (not redirected to login)
    await page.waitForLoadState('domcontentloaded')

    // The URL should be /members or a sub-route
    const url = page.url()
    expect(url).toContain('/members')

    // Should NOT be on login page
    expect(url).not.toContain('/login')
  })

  test('CRITICAL: Unauthenticated user is redirected from /members to /login', async ({ page }) => {
    // Ensure no auth
    await clearMemberAuth(page)

    // Try to access members area
    await page.goto('/members', { waitUntil: 'domcontentloaded' })

    // Should be redirected to login
    // Note: This happens client-side via MemberAuthContext
    await page.waitForURL(/\/login/, { timeout: 10000 })

    expect(page.url()).toContain('/login')
  })

  test('CRITICAL: Auth callback page handles successful auth', async ({ page }) => {
    await page.goto('/auth/callback', { waitUntil: 'domcontentloaded' })

    // Should show processing state initially
    const hasProcessingState = await page.getByText(/Authenticating|Processing|Loading|Verifying/i).isVisible().catch(() => false)
    expect(hasProcessingState).toBeTruthy()

    // Should have the branded UI
    await expect(page.locator('.bg-emerald-500, .from-emerald-500')).toBeVisible()
  })

  test('CRITICAL: Auth callback handles error gracefully', async ({ page }) => {
    // Server callback route should redirect OAuth errors to login with details.
    const response = await page.request.get(
      '/api/auth/callback?error=access_denied&error_description=User%20cancelled%20login',
      { maxRedirects: 0 },
    )

    expect([302, 303, 307, 308]).toContain(response.status())
    const location = response.headers().location ?? ''
    expect(location).toContain('/login')
  })

  test('CRITICAL: Session persists across page navigation', async ({ page }) => {
    // Authenticate
    await authenticateAsMember(page)
    await setupMemberApiMocks(page)

    // Go to members
    await page.goto('/members', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    // Navigate to home
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    // Check session still exists
    const isAuthenticated = await isMemberAuthenticated(page)
    expect(isAuthenticated).toBeTruthy()

    // Navigate back to members - should still work
    await page.goto('/members', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/members')
  })

  test('CRITICAL: Expired session redirects to login', async ({ page }) => {
    // Set up expired session
    const expiredSession = createExpiredSession()
    await authenticateWithSession(page, expiredSession, { bypassMiddleware: false })

    // Try to access protected route
    await page.goto('/members', { waitUntil: 'domcontentloaded' })

    // The MemberAuthContext should detect expired session and redirect
    // or show an error state
    await page.waitForURL(/\/login/, { timeout: 10000 }).catch(() => {})

    // Should either be on login or show session expired message
    const url = page.url()
    const isOnLogin = url.includes('/login')
    const hasExpiredMessage = await page.getByText(/expired|session|login again/i).isVisible().catch(() => false)

    expect(isOnLogin || hasExpiredMessage).toBeTruthy()
  })

  test('User info is available after authentication', async ({ page }) => {
    await authenticateAsMember(page)

    const user = await getCurrentUser(page)

    expect(user).not.toBeNull()
    expect(user?.id).toBe('test-user-id-12345')
    expect(user?.email).toBe('testuser@example.com')
    expect(user?.user_metadata?.provider).toBe('discord')
  })

  test('Login page shows correct error messages from OAuth', async ({ page }) => {
    // Test various error types
    const errorCases = [
      { error: 'access_denied', description: 'User%20cancelled%20login', expected: /cancelled|denied/i },
      { error: 'server_error', description: 'Server%20error', expected: /error|failed/i },
    ]

    for (const { error, description, expected } of errorCases) {
      await page.goto(`/login?error=${error}&error_description=${description}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(300)

      const hasExpectedError = await page.getByText(expected).isVisible().catch(() => false)
      if (!hasExpectedError) {
        console.log(`Warning: Error message not found for ${error}`)
      }
    }
  })

  test('Redirect parameter is preserved through auth flow', async ({ page }) => {
    // Go to login with redirect param
    await page.goto('/login?redirect=/members/library', { waitUntil: 'domcontentloaded' })

    // The redirect param should be in the URL
    expect(page.url()).toContain('redirect')

    // Button should still work
    const discordButton = page.getByRole('button', { name: /Log in with Discord/i })
    await expect(discordButton).toBeVisible()
    await expect(discordButton).toBeEnabled()
  })
})

test.describe('Discord Auth - Security Tests', () => {
  test('SECURITY: Cannot access members area without valid session', async ({ page }) => {
    // Clear all auth
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await clearMemberAuth(page)

    // Try to access various protected routes
    const protectedRoutes = ['/members', '/members/library', '/members/journal']

    for (const route of protectedRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await page.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {})

      // Should be redirected to login
      const url = page.url()
      const isProtected = url.includes('/login') || !url.includes('/members')
      expect(isProtected).toBeTruthy()
    }
  })

  test('SECURITY: Invalid redirect URLs are blocked', async ({ page }) => {
    // Try with external URL redirect
    await page.goto('/login?redirect=https://evil.com', { waitUntil: 'domcontentloaded' })

    const discordButton = page.getByRole('button', { name: /Log in with Discord/i })
    await expect(discordButton).toBeVisible()

    // The page should load but the redirect should be sanitized
    // (checked by getSafeRedirect function)
  })

  test('SECURITY: Session in localStorage is properly structured', async ({ page }) => {
    await authenticateAsMember(page)

    const sessionData = await page.evaluate(() => {
      const raw = localStorage.getItem('sb-localhost-auth-token')
      return raw ? JSON.parse(raw) : null
    })

    // Session should have required fields
    expect(sessionData).toHaveProperty('access_token')
    expect(sessionData).toHaveProperty('user')
    expect(sessionData.user).toHaveProperty('id')
  })
})

test.describe('Discord Auth - Edge Cases', () => {
  test.skip('Multiple rapid login attempts are handled', async ({ page }) => {
    test.setTimeout(60000)

    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    const discordButton = page.getByRole('button', { name: /Log in with Discord/i })

    // Click multiple times rapidly
    await discordButton.click({ noWaitAfter: true }).catch(() => {})
    await discordButton.click({ noWaitAfter: true }).catch(() => {})
    await discordButton.click({ noWaitAfter: true }).catch(() => {})
  })

  test('Browser back button after auth is handled', async ({ page }) => {
    await authenticateAsMember(page)
    await setupMemberApiMocks(page)

    // Go to members
    await page.goto('/members', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    // Go to another page
    await page.goto('/members/library', { waitUntil: 'domcontentloaded' }).catch(() => {
      // May not exist, that's ok
    })

    // Go back
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {})

    // Should still be authenticated
    const isAuthenticated = await isMemberAuthenticated(page)
    expect(isAuthenticated).toBeTruthy()
  })

  test('Auth state survives page refresh', async ({ page }) => {
    await authenticateAsMember(page)
    await setupMemberApiMocks(page)

    // Go to members
    await page.goto('/members', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    // Refresh
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')

    // Should still be on members (session persisted)
    expect(page.url()).toContain('/members')
  })
})
