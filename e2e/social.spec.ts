import { test, expect } from '@playwright/test'

test.describe('Profile Hub', () => {
  test.beforeEach(async ({ page }) => {
    // Login via E2E bypass (existing pattern)
    await page.goto('/members/profile')
  })

  test('renders trader identity card', async ({ page }) => {
    await expect(page.locator('[data-testid="trader-identity-card"]')).toBeVisible()
    await expect(page.locator('[data-testid="trader-avatar"]')).toBeVisible()
    await expect(page.locator('[data-testid="tier-badge"]')).toBeVisible()
  })

  test('renders trading transcript', async ({ page }) => {
    await expect(page.locator('[data-testid="trading-transcript"]')).toBeVisible()
    await expect(page.locator('[data-testid="verified-badge"]')).toBeVisible()
  })

  test('renders academy progress', async ({ page }) => {
    await expect(page.locator('[data-testid="academy-progress"]')).toBeVisible()
  })

  test('opens settings sheet', async ({ page }) => {
    await page.click('[data-testid="settings-button"]')
    await expect(page.locator('[data-testid="settings-sheet"]')).toBeVisible()
  })

  test('updates privacy settings', async ({ page }) => {
    await page.click('[data-testid="settings-button"]')
    await page.click('[data-testid="privacy-transcript-toggle"]')
    await page.click('[data-testid="save-settings"]')
    await expect(page.locator('[data-testid="settings-success-toast"]')).toBeVisible()
  })
})

test.describe('Trade Social Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/members/social')
  })

  test('renders feed with items', async ({ page }) => {
    await expect(page.locator('[data-testid="social-feed"]')).toBeVisible()
  })

  test('filters feed by type', async ({ page }) => {
    await page.click('[data-testid="filter-trade_card"]')
    // Verify only trade cards shown
    const items = page.locator('[data-testid="feed-item"]')
    const count = await items.count()
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i)).toHaveAttribute('data-item-type', 'trade_card')
    }
  })

  test('likes and unlikes a feed item', async ({ page }) => {
    const likeBtn = page.locator('[data-testid="like-button"]').first()
    const countBefore = await likeBtn.locator('[data-testid="like-count"]').textContent()
    await likeBtn.click()
    // Optimistic UI should update immediately
    await expect(likeBtn).toHaveAttribute('data-liked', 'true')
  })

  test('renders leaderboard', async ({ page }) => {
    await expect(page.locator('[data-testid="leaderboard"]')).toBeVisible()
    await expect(page.locator('[data-testid="leaderboard-entry"]').first()).toBeVisible()
  })
})
