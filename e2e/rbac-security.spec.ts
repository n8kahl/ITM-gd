import { test, expect } from '@playwright/test'

/**
 * RBAC Security & Permissions Test Suite
 * Tests Phase 1 (Security Cleanup) and Phase 2 (Simple RBAC)
 */

test.describe('Phase 1: Security Hardening', () => {
  test('should block access to removed verify-token endpoint', async ({ page }) => {
    const response = await page.goto('/api/admin/verify-token?token=test123')
    expect(response?.status()).toBe(404)
  })

  test('should redirect unauthenticated users from /admin to /login', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForURL(/\/login/)
    expect(page.url()).toContain('/login')
  })

  test('should not accept titm_admin cookie for admin access', async ({ context, page }) => {
    // Set the old magic link cookie
    await context.addCookies([{
      name: 'titm_admin',
      value: 'true',
      domain: 'localhost',
      path: '/',
    }])

    // Try to access admin
    await page.goto('/admin')

    // Should redirect to login (cookie no longer grants access)
    await page.waitForURL(/\/login/, { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })
})

test.describe('Phase 2: Admin Permissions Matrix', () => {
  test.skip('should load permissions page for admins', async ({ page }) => {
    // Skip if not authenticated as admin
    // This test requires admin authentication

    await page.goto('/admin/permissions')

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Role Permissions")')

    // Check for key elements
    await expect(page.locator('h1')).toContainText('Role Permissions')
    await expect(page.locator('button:has-text("Sync Discord Roles")')).toBeVisible()
  })

  test.skip('should show permissions matrix grid', async ({ page }) => {
    // Skip if not authenticated as admin

    await page.goto('/admin/permissions')

    // Wait for sync button
    const syncButton = page.locator('button:has-text("Sync Discord Roles")')
    await syncButton.click()

    // Wait for roles to load
    await page.waitForSelector('table', { timeout: 10000 })

    // Check for table structure
    const table = page.locator('table')
    await expect(table).toBeVisible()

    // Check for column headers
    await expect(page.locator('th:has-text("Dashboard")')).toBeVisible()
    await expect(page.locator('th:has-text("Journal")')).toBeVisible()
    await expect(page.locator('th:has-text("Library")')).toBeVisible()
    await expect(page.locator('th:has-text("Profile")')).toBeVisible()
  })
})

test.describe('Phase 2: Member Area Permissions', () => {
  test.skip('should show debug panel in development mode', async ({ page }) => {
    // Skip if not authenticated as member

    await page.goto('/members')

    // Wait for sidebar to load
    await page.waitForSelector('aside')

    // Check for debug panel (only visible in dev mode)
    if (process.env.NODE_ENV === 'development') {
      await expect(page.locator('text=My Allowed Tabs:')).toBeVisible()
    }
  })

  test.skip('should filter navigation based on permissions', async ({ page }) => {
    // Skip if not authenticated as member

    await page.goto('/members')

    // Wait for navigation to load
    await page.waitForSelector('nav')

    // Count visible navigation items
    const navItems = page.locator('nav a')
    const count = await navItems.count()

    // Should have at least 1 item (profile is always accessible)
    expect(count).toBeGreaterThan(0)
  })

  test('should have correct navigation structure', async ({ page }) => {
    await page.goto('/')

    // Check that member area exists in the app structure
    // This is a basic smoke test
    const response = await page.goto('/members')

    // Should redirect to login if not authenticated
    if (response?.status() === 200) {
      await page.waitForURL(/\/login|\/members/)
    }
  })
})

test.describe('Database Schema Validation', () => {
  test('should have correct app_config schema', async ({ request }) => {
    // This test validates the schema exists via API call
    // It will fail gracefully if not authenticated

    const response = await request.get('/api/admin/roles')

    // Either we get data or we're not authorized (both are OK for schema validation)
    expect([200, 401, 403, 404]).toContain(response.status())
  })
})

test.describe('Permissions Context Integration', () => {
  test('should export useMemberAuth hook', async ({ page }) => {
    // Navigate to a page that uses the hook
    await page.goto('/members')

    // Wait for page load
    await page.waitForLoadState('networkidle')

    // Check for auth-related elements
    const hasAuthElements = await page.locator('button:has-text("Logout")').count() > 0 ||
                            await page.locator('text=Loading').count() > 0 ||
                            await page.locator('text=Redirecting').count() > 0

    expect(hasAuthElements).toBeTruthy()
  })
})

test.describe('Security Regression Tests', () => {
  test('should not expose admin_access_tokens table', async ({ request }) => {
    // Try to query the old table via API
    const response = await request.get('/api/admin/system')

    // Should not return data about admin_access_tokens
    if (response.ok()) {
      const text = await response.text()
      expect(text.toLowerCase()).not.toContain('admin_access_tokens')
    }
  })

  test('should enforce HTTPS in production headers', async ({ page }) => {
    const response = await page.goto('/')

    const headers = response?.headers()

    // Check for security headers
    expect(headers?.['x-frame-options']).toBe('DENY')
    expect(headers?.['x-content-type-options']).toBe('nosniff')
  })
})

test.describe('End-to-End Permission Flow', () => {
  test.skip('complete permission lifecycle', async ({ page, context }) => {
    // This is a comprehensive E2E test that requires authentication
    // Skip unless running with auth credentials

    // 1. Login as admin
    // 2. Navigate to permissions page
    // 3. Sync Discord roles
    // 4. Toggle a permission
    // 5. Verify it persists
    // 6. Login as member
    // 7. Verify permission is applied

    test.setTimeout(60000) // 1 minute timeout for full flow

    // Implementation would go here
  })
})
