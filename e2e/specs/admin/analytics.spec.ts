import { test, expect } from '@playwright/test'
import { authenticateAsAdmin } from '../../helpers/admin-auth'
import { setupAdminApiMocks } from '../../helpers/api-mocks'

test.describe('Admin: Analytics Dashboard', () => {
  test.beforeEach(async ({ context, page }) => {
    await authenticateAsAdmin(context)
    await setupAdminApiMocks(page)
  })

  test('displays analytics page header', async ({ page }) => {
    await page.goto('/admin/analytics')
    await expect(page.getByText('Analytics').first()).toBeVisible({ timeout: 10000 })
  })

  test('shows period filter buttons', async ({ page }) => {
    await page.goto('/admin/analytics')
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Last 7 Days' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Last 30 Days' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'All Time' })).toBeVisible()
  })

  test('displays metric cards with values', async ({ page }) => {
    await page.goto('/admin/analytics')
    await expect(page.getByText('Total Page Views')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('28,500')).toBeVisible()
    await expect(page.getByText('Unique Visitors')).toBeVisible()
    await expect(page.getByText('4,200')).toBeVisible()
    await expect(page.getByText('Conversion Rate')).toBeVisible()
  })

  test('has refresh and command center buttons', async ({ page }) => {
    await page.goto('/admin/analytics')
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /Command Center/i })).toBeVisible()
  })

  test('shows chart sections', async ({ page }) => {
    await page.goto('/admin/analytics')
    await expect(page.getByText('Page Views Over Time')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Conversion Funnel')).toBeVisible()
    await expect(page.getByText('Browser Breakdown')).toBeVisible()
    await expect(page.getByText('Device Breakdown')).toBeVisible()
  })

  test('shows data tables for subscribers, contacts, page views', async ({ page }) => {
    await page.goto('/admin/analytics')
    await expect(page.getByText(/Recent Subscribers/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Recent Contact Submissions/i)).toBeVisible()
    await expect(page.getByText(/Recent Page Views/i)).toBeVisible()
  })
})
