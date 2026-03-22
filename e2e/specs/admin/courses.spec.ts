import { test, expect } from '@playwright/test'
import { authenticateAsAdmin } from '../../helpers/admin-auth'
import { setupAdminApiMocks } from '../../helpers/api-mocks'

test.describe('Admin: Course Management', () => {
  test.beforeEach(async ({ context, page }) => {
    await authenticateAsAdmin(context)
    await setupAdminApiMocks(page)
  })

  test('displays course management page header', async ({ page }) => {
    await page.goto('/admin/courses')
    await expect(page.getByRole('heading', { name: /Course Management/i })).toBeVisible()
    await expect(page.getByText(/Create and manage your course library/i)).toBeVisible()
  })

  test('shows new course and refresh buttons', async ({ page }) => {
    await page.goto('/admin/courses')
    await expect(page.getByRole('button', { name: /New Course/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible()
  })

  test('displays courses list with course data', async ({ page }) => {
    await page.goto('/admin/courses')
    await expect(page.getByText('Options Mastery')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('SPX Day Trading')).toBeVisible()
    await expect(page.getByText('All Courses (2)')).toBeVisible()
  })

  test('shows published and draft status badges', async ({ page }) => {
    await page.goto('/admin/courses')
    await expect(page.getByText('Published')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Draft')).toBeVisible()
  })

  test('shows gated badge for role-restricted courses', async ({ page }) => {
    await page.goto('/admin/courses')
    await expect(page.getByText('Gated')).toBeVisible({ timeout: 10000 })
  })

  test('shows lesson count for each course', async ({ page }) => {
    await page.goto('/admin/courses')
    await expect(page.getByText('3 lessons')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('1 lessons')).toBeVisible()
  })

  test('shows empty state when no courses exist', async ({ page }) => {
    await page.route('/api/admin/courses*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    })

    await page.goto('/admin/courses')
    await expect(page.getByText('No courses yet')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Create your first course to get started')).toBeVisible()
  })
})
