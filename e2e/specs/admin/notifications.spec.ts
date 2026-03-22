import { test, expect } from '@playwright/test'
import { authenticateAsAdmin } from '../../helpers/admin-auth'
import { setupAdminApiMocks } from '../../helpers/api-mocks'

test.describe('Admin: Push Notifications', () => {
  test.beforeEach(async ({ context, page }) => {
    await authenticateAsAdmin(context)
    await setupAdminApiMocks(page)
  })

  test('displays push notifications page header', async ({ page }) => {
    await page.goto('/admin/notifications')
    await expect(page.getByRole('heading', { name: /Push Notifications/i })).toBeVisible()
    await expect(page.getByText(/Compose and send push notifications/i)).toBeVisible()
  })

  test('shows compose notification form', async ({ page }) => {
    await page.goto('/admin/notifications')
    await expect(page.getByText('Compose Notification')).toBeVisible({ timeout: 10000 })
    await expect(page.getByPlaceholder('New Trade Alert')).toBeVisible()
    await expect(page.getByPlaceholder(/We just posted/)).toBeVisible()
  })

  test('shows target audience selector with all options', async ({ page }) => {
    await page.goto('/admin/notifications')
    await expect(page.getByText('Target Audience')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /All Users/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /By Tier/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Individual/i })).toBeVisible()
  })

  test('shows send button disabled when form is empty', async ({ page }) => {
    await page.goto('/admin/notifications')
    const sendButton = page.getByRole('button', { name: /Send Notification/i })
    await expect(sendButton).toBeVisible({ timeout: 10000 })
    await expect(sendButton).toBeDisabled()
  })

  test('shows broadcast history section with past notifications', async ({ page }) => {
    await page.goto('/admin/notifications')
    await expect(page.getByText('Broadcast History')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('New Trade Alert').first()).toBeVisible()
    await expect(page.getByText('Weekly Recap')).toBeVisible()
  })

  test('shows status filter dropdown in history', async ({ page }) => {
    await page.goto('/admin/notifications')
    const filter = page.locator('select')
    await expect(filter).toBeVisible({ timeout: 10000 })
  })

  test('shows deep link URL and tag fields', async ({ page }) => {
    await page.goto('/admin/notifications')
    await expect(page.getByPlaceholder('/members/journal')).toBeVisible({ timeout: 10000 })
    await expect(page.getByPlaceholder('trade-alert')).toBeVisible()
  })

  test('shows require interaction toggle', async ({ page }) => {
    await page.goto('/admin/notifications')
    await expect(page.getByRole('switch')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Require interaction/i)).toBeVisible()
  })
})
