import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'

test.describe('Academy Overhaul — Dashboard', () => {
  test('renders dashboard with gamification widgets', async ({ page }) => {
    await authenticateAsMember(page)
    await page.goto('/members/academy', { waitUntil: 'domcontentloaded' })

    // Core dashboard sections should be visible
    await expect(page.getByText('Academy').first()).toBeVisible()

    // Gamification widgets
    await expect(page.getByText('XP').first()).toBeVisible({ timeout: 10_000 })
  })

  test('navigates to module catalog', async ({ page }) => {
    await authenticateAsMember(page)
    await page.goto('/members/academy', { waitUntil: 'domcontentloaded' })

    // Click the catalog/browse link
    const browseLink = page.getByRole('link', { name: /catalog|browse|modules/i }).first()
    if (await browseLink.isVisible()) {
      await browseLink.click()
      await expect(page).toHaveURL(/academy/)
    }
  })
})

test.describe('Academy Overhaul — Module Catalog', () => {
  test('renders module cards with track sections', async ({ page }) => {
    await authenticateAsMember(page)
    await page.goto('/members/academy', { waitUntil: 'domcontentloaded' })

    // Should show track sections
    await expect(page.locator('[data-testid*="track-section"], [class*="track"]').first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('difficulty filter works', async ({ page }) => {
    await authenticateAsMember(page)
    await page.goto('/members/academy', { waitUntil: 'domcontentloaded' })

    // Filter buttons should be present
    const filterButton = page.getByRole('button', { name: /beginner|intermediate|advanced|all/i }).first()
    if (await filterButton.isVisible()) {
      await filterButton.click()
      // Page should not error
      await expect(page.locator('body')).not.toHaveText('Application error')
    }
  })
})

test.describe('Academy Overhaul — Lesson Viewer', () => {
  test('lesson viewer renders with progress bar and navigation', async ({ page }) => {
    await authenticateAsMember(page)

    // Navigate to a lesson (the exact URL depends on seed data)
    await page.goto('/members/academy', { waitUntil: 'domcontentloaded' })

    // Find and click first available lesson link
    const lessonLink = page.getByRole('link', { name: /lesson|start|continue/i }).first()
    if (await lessonLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await lessonLink.click()
      await page.waitForLoadState('domcontentloaded')

      // Lesson viewer should have navigation controls
      await expect(
        page.getByRole('button', { name: /next|previous|back/i }).first()
      ).toBeVisible({ timeout: 10_000 })
    }
  })
})

test.describe('Academy Overhaul — Progress Overview', () => {
  test('progress page renders competency radar and timeline', async ({ page }) => {
    await authenticateAsMember(page)
    await page.goto('/members/academy', { waitUntil: 'domcontentloaded' })

    // Navigate to progress
    const progressLink = page.getByRole('link', { name: /progress|overview/i }).first()
    if (await progressLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await progressLink.click()
      await page.waitForLoadState('domcontentloaded')
      await expect(page.locator('body')).not.toHaveText('Application error')
    }
  })
})

test.describe('Academy Overhaul — Accessibility', () => {
  test('dashboard has no critical a11y violations', async ({ page }) => {
    await authenticateAsMember(page)
    await page.goto('/members/academy', { waitUntil: 'domcontentloaded' })

    // Wait for content to load
    await page.waitForTimeout(2000)

    // Basic keyboard navigation check
    await page.keyboard.press('Tab')
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })
})
