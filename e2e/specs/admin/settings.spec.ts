import { test, expect } from '@playwright/test'
import { authenticateAsAdmin } from '../../helpers/admin-auth'
import { setupAdminApiMocks } from '../../helpers/api-mocks'

test.describe('Admin: Configuration Center', () => {
  test.beforeEach(async ({ context, page }) => {
    await authenticateAsAdmin(context)
    await setupAdminApiMocks(page)
  })

  test('displays configuration center page', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByRole('heading', { name: /Configuration Center/i })).toBeVisible()
    await expect(page.getByText(/Manage system secrets and configuration/i)).toBeVisible()
  })

  test('shows security notice about masked values', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByText(/Security Notice/i)).toBeVisible()
    await expect(page.getByText(/Sensitive values are masked by default/i)).toBeVisible()
  })

  test('displays Discord integration settings', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByText(/Discord Integration/i)).toBeVisible()
    await expect(page.getByText(/Discord Guild ID/i)).toBeVisible()
  })

  test('displays Telegram notification settings', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByText(/Telegram Notifications/i)).toBeVisible()
  })

  test('displays API Keys section', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByText(/API Keys/i)).toBeVisible()
  })

  test('shows masked values with dots', async ({ page }) => {
    await page.goto('/admin/settings')
    // Masked values should show as dots
    const maskedValues = page.locator('input[type="password"]')
    await expect(maskedValues.first()).toBeVisible()
  })

  test('has reveal button for sensitive values', async ({ page }) => {
    await page.goto('/admin/settings')
    // Look for buttons that can reveal/hide values (should have title or aria-label)
    const revealButtons = page.getByTitle(/Reveal|Hide/i)
    await expect(revealButtons.first()).toBeVisible()
  })

  test('has add setting button', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByRole('button', { name: /Add Setting/i })).toBeVisible()
  })

  test('has refresh button', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible()
  })

  test('shows test notification button for Telegram', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByRole('button', { name: /Test Notification/i })).toBeVisible()
  })

  test('can open add setting modal', async ({ page }) => {
    await page.goto('/admin/settings')
    await page.getByRole('button', { name: /Add Setting/i }).click()
    await expect(page.getByText(/Add New Setting/i)).toBeVisible()
    await expect(page.getByPlaceholder(/setting_key/i)).toBeVisible()
  })
})
