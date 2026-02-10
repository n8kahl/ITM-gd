import { test, expect } from '@playwright/test'
import { authenticateAsAdmin } from '../../helpers/admin-auth'
import { setupAdminApiMocks } from '../../helpers/api-mocks'

test.describe('Admin: Configuration Center', () => {
  test.beforeEach(async ({ context, page }) => {
    await authenticateAsAdmin(context)
    await setupAdminApiMocks(page)
  })

  test('displays Discord configuration page', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByRole('heading', { name: /Discord Configuration/i })).toBeVisible()
    await expect(page.getByText(/Configure your Discord integration settings/i)).toBeVisible()
  })

  test('shows security notice about masked values', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByText(/Security Notice/i)).toBeVisible()
    await expect(page.getByText(/Sensitive values are masked by default/i)).toBeVisible()
  })

  test('displays Discord integration settings', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByText(/Discord Integration/i).first()).toBeVisible()
    await expect(page.getByText(/Guild ID/i).first()).toBeVisible()
  })

  test('displays AI system prompt section', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByText(/AI System Prompt/i)).toBeVisible()
    await expect(page.getByText(/System Prompt Content/i)).toBeVisible()
  })

  test('displays membership tier mapping section', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByText(/Membership Tier Mapping/i)).toBeVisible()
    await expect(page.getByText(/Map Discord role IDs to membership tiers/i)).toBeVisible()
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
    const revealButtons = page.getByTitle(/Show|Hide/i)
    await expect(revealButtons.first()).toBeVisible()
  })

  test('has add tier mapping controls', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByPlaceholder(/Discord Role ID/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Add$/i })).toBeVisible()
  })

  test('has refresh button', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible()
  })

  test('shows test connection button', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByRole('button', { name: /Test Connection/i })).toBeVisible()
  })

  test('shows save actions for settings sections', async ({ page }) => {
    await page.goto('/admin/settings')
    await expect(page.getByRole('button', { name: /Save Configuration/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Save AI Prompt/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Save Tier Mapping/i })).toBeVisible()
  })
})
