import { test, expect } from '@playwright/test'
import { authenticateAsAdmin } from '../../helpers/admin-auth'
import { setupAdminApiMocks } from '../../helpers/api-mocks'

test.describe('Admin: Dashboard Command Center', () => {
  test.beforeEach(async ({ context, page }) => {
    await authenticateAsAdmin(context)
    await setupAdminApiMocks(page)
  })

  test('displays command center heading and subtitle', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: /Command Center/i })).toBeVisible()
    await expect(page.getByText(/Live admin operations and platform health/i)).toBeVisible()
  })

  test('shows period selector buttons', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('button', { name: 'Today' })).toBeVisible()
    await expect(page.getByRole('button', { name: '7D' })).toBeVisible()
    await expect(page.getByRole('button', { name: '30D' })).toBeVisible()
  })

  test('displays metric cards with data', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByText('Registered Members')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('1,250')).toBeVisible()
    await expect(page.getByText('System Health')).toBeVisible()
  })

  test('shows quick links to admin sections', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('link', { name: /Courses/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('link', { name: /Leads/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Chat/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Settings/i })).toBeVisible()
  })

  test('displays system status section with diagnostic results', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByText('System Status')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Database Connection')).toBeVisible()
    await expect(page.getByText('100%')).toBeVisible()
  })

  test('shows recent applications section', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByText('Recent Applications')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Alice Johnson')).toBeVisible()
    await expect(page.getByText('Bob Chen')).toBeVisible()
  })

  test('has refresh button for command center', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByTitle('Refresh command center')).toBeVisible()
  })
})
