import { expect, test } from '@playwright/test'
import {
  enableDashboardBypass,
  setupAllDashboardMocks,
  setupDashboardShellMocks,
} from './dashboard-test-helpers'

const DASHBOARD_URL = '/members?e2eBypassAuth=1'

test('redirects unauthenticated users to login', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/members', { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/login/)
  await expect(page).toHaveURL(/\/login/)
})

test.describe('Dashboard Navigation', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableDashboardBypass(page)
    await setupDashboardShellMocks(page)
    await setupAllDashboardMocks(page)
  })

  test('navigates to journal from Log Trade quick action', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })

    const logTradeLink = page.getByRole('link', { name: 'Log Trade' })
    await expect(logTradeLink).toBeVisible()

    const href = await logTradeLink.getAttribute('href')
    expect(href).toContain('/members/journal')
  })

  test('navigates to AI Coach from quick action', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })

    const aiCoachLink = page.getByRole('link', { name: 'Ask AI Coach' })
    await expect(aiCoachLink).toBeVisible()

    const href = await aiCoachLink.getAttribute('href')
    expect(href).toContain('/members/ai-coach')
  })

  test('shows sidebar navigation on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })

    // Sidebar should have navigation links
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible()
  })

  test('shows mobile bottom nav on narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })

    // Wait for dashboard content to appear
    const welcomeSection = page.locator('[aria-label="Dashboard welcome"]')
    await expect(welcomeSection).toBeVisible()

    // Mobile bottom nav should be present
    const bottomNav = page.locator('nav[class*="fixed"][class*="bottom-0"]').or(
      page.locator('[class*="fixed bottom-0"]'),
    )
    await expect(bottomNav.first()).toBeVisible()
  })
})
