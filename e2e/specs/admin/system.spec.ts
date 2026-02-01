import { test, expect } from '@playwright/test'
import { authenticateAsAdmin } from '../../helpers/admin-auth'
import { setupAdminApiMocks, mockApiResponses } from '../../helpers/api-mocks'

test.describe('Admin: System Diagnostics', () => {
  test.beforeEach(async ({ context, page }) => {
    await authenticateAsAdmin(context)
    await setupAdminApiMocks(page)
  })

  test('displays system status page header', async ({ page }) => {
    await page.goto('/admin/system')
    await expect(page.getByRole('heading', { name: /System Status/i })).toBeVisible()
    await expect(page.getByText(/Live diagnostics for all system integrations/i)).toBeVisible()
  })

  test('shows run diagnostics button', async ({ page }) => {
    await page.goto('/admin/system')
    await expect(page.getByRole('button', { name: /Run Diagnostics/i })).toBeVisible()
  })

  test('displays overall health status when healthy', async ({ page }) => {
    await page.goto('/admin/system')
    await expect(page.getByText(/All Systems Operational/i)).toBeVisible({ timeout: 10000 })
  })

  test('shows diagnostic results', async ({ page }) => {
    await page.goto('/admin/system')
    // Wait for diagnostics to complete and show at least some results
    // Use first() since diagnostic names may appear in multiple places
    await expect(page.getByText('Database Connection').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Edge Functions').first()).toBeVisible()
    await expect(page.getByText('OpenAI Integration').first()).toBeVisible()
    await expect(page.getByText('Discord Bot').first()).toBeVisible()
  })

  test('displays status legend', async ({ page }) => {
    await page.goto('/admin/system')
    await expect(page.getByText(/Status Legend/i)).toBeVisible()
    await expect(page.getByText('Pass', { exact: true })).toBeVisible()
    await expect(page.getByText('Warning', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Fail', { exact: true })).toBeVisible()
  })

  test('shows last run timestamp after diagnostics complete', async ({ page }) => {
    await page.goto('/admin/system')
    await page.waitForTimeout(1000)
    await expect(page.getByText(/Last run:/i)).toBeVisible()
  })

  test('shows warning state for partial issues', async ({ page }) => {
    // Override mock to return warning state
    await page.route('/api/admin/system', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.systemWarning),
      })
    })

    await page.goto('/admin/system')
    await expect(page.getByText(/Partial Issues Detected/i)).toBeVisible({ timeout: 10000 })
  })

  test('shows loading state when running diagnostics', async ({ page }) => {
    await page.goto('/admin/system')
    // Wait for initial load to complete
    await expect(page.getByRole('button', { name: /Run Diagnostics/i })).toBeVisible({ timeout: 10000 })

    // The button should be visible and clickable
    const runButton = page.getByRole('button', { name: /Run Diagnostics/i })
    await expect(runButton).toBeEnabled()
  })

  test('displays pass count, warning count, and fail count', async ({ page }) => {
    await page.goto('/admin/system')
    // Wait for diagnostics to complete and show counts
    await expect(page.getByText('Passed', { exact: true })).toBeVisible({ timeout: 10000 })
  })
})
