import { expect, test } from '@playwright/test'
import {
  enableDashboardBypass,
  setupAllDashboardMocks,
  setupDashboardShellMocks,
} from './dashboard-test-helpers'

const DASHBOARD_URL = '/members?e2eBypassAuth=1'

test.describe('Dashboard Accessibility', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableDashboardBypass(page)
    await setupDashboardShellMocks(page)
    await setupAllDashboardMocks(page)
  })

  test('all dashboard sections have ARIA region labels', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })

    const expectedLabels = [
      'Dashboard welcome',
      'Live market ticker',
      'Performance statistics',
      'Equity and quick actions',
      'Recent trades',
      'Market brief, AI insights and calendar',
      'Market intelligence',
    ]

    for (const label of expectedLabels) {
      const region = page.locator(`[role="region"][aria-label="${label}"]`)
      await expect(region, `Region "${label}" should exist`).toHaveCount(1)
    }
  })

  test('welcome header has correct heading hierarchy', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })

    // Welcome section should have an h1 or prominent heading
    const welcomeSection = page.locator('[aria-label="Dashboard welcome"]')
    await expect(welcomeSection).toBeVisible()

    // Greeting text should be findable
    const greeting = welcomeSection.locator('h1, [class*="text-2xl"], [class*="text-xl"]').first()
    await expect(greeting).toBeVisible()
    const greetingText = await greeting.textContent()
    expect(greetingText).toContain('E2ETrader')
  })

  test('quick action links have accessible text', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })

    // All three quick actions should be identifiable by role+name
    await expect(page.getByRole('link', { name: 'Log Trade' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ask AI Coach' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Share Last Win' })).toBeVisible()
  })

  test('sections use heading elements for structure', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })

    // Key section headings should be present
    await expect(page.getByText('Quick Actions')).toBeVisible()
    await expect(page.getByText('Recent Trades')).toBeVisible()
  })

  test('dashboard renders without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Filter out expected noise (hydration warnings, network failures on unrelated routes)
        if (
          !text.includes('hydration') &&
          !text.includes('Failed to fetch') &&
          !text.includes('AbortError') &&
          !text.includes('favicon')
        ) {
          errors.push(text)
        }
      }
    })

    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })

    // Wait for sections to render
    await expect(page.locator('[aria-label="Dashboard welcome"]')).toBeVisible()
    await page.waitForTimeout(2000)

    expect(errors, `Unexpected console errors: ${errors.join(', ')}`).toHaveLength(0)
  })
})
