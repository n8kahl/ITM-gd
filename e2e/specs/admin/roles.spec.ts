import { test, expect } from '@playwright/test'
import { authenticateAsAdmin, clearAdminAuth } from '../../helpers/admin-auth'
import { setupAdminApiMocks } from '../../helpers/api-mocks'

test.describe('Admin: Discord Role Mapping', () => {
  test.beforeEach(async ({ context, page }) => {
    await authenticateAsAdmin(context)
    await setupAdminApiMocks(page)
  })

  test('displays role mapping page with header', async ({ page }) => {
    await page.goto('/admin/roles')
    await expect(page.getByRole('heading', { name: /Discord Role Mapping/i })).toBeVisible()
    await expect(page.getByText(/Map Discord roles to application permissions/i)).toBeVisible()
  })

  test('shows loading state initially', async ({ page }) => {
    // Delay API response to see loading state
    await page.route('/api/admin/roles', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500))
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, roles: [], permissions: [] }),
      })
    })

    await page.goto('/admin/roles')
    await expect(page.getByText(/Loading role mappings/i)).toBeVisible()
  })

  test('displays existing role mappings', async ({ page }) => {
    await page.goto('/admin/roles')
    await expect(page.getByText('Core Sniper')).toBeVisible()
    await expect(page.getByText('Pro Sniper')).toBeVisible()
  })

  test('shows available permissions', async ({ page }) => {
    await page.goto('/admin/roles')
    await expect(page.getByText('view_courses').first()).toBeVisible()
    await expect(page.getByText('view_premium_content').first()).toBeVisible()
  })

  test('has add new mapping button', async ({ page }) => {
    await page.goto('/admin/roles')
    await expect(page.getByRole('button', { name: /Add New Mapping/i })).toBeVisible()
  })

  test('shows role template suggestions', async ({ page }) => {
    await page.goto('/admin/roles')
    await expect(page.getByText(/Suggested Role Templates/i)).toBeVisible()
  })

  test('redirects unauthenticated users', async ({ page, context }) => {
    await clearAdminAuth(context)
    await page.goto('/admin/roles')
    // Should redirect to home page
    await page.waitForURL('/')
    expect(page.url()).not.toContain('/admin')
  })
})
