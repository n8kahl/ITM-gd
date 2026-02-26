import { expect, test } from '@playwright/test'
import {
  enableDashboardBypass,
  setupAllDashboardMocks,
  setupDashboardShellMocks,
  setupEquityCurveMock,
} from './dashboard-test-helpers'

const DASHBOARD_URL = '/members?e2eBypassAuth=1'

test.describe('Dashboard Equity Curve', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableDashboardBypass(page)
    await setupDashboardShellMocks(page)
    await setupAllDashboardMocks(page)
  })

  test('renders equity curve section', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })

    const equitySection = page.locator('[aria-label="Equity and quick actions"]')
    await expect(equitySection).toBeVisible()
  })

  test('shows period selector buttons', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })

    const equitySection = page.locator('[aria-label="Equity and quick actions"]')
    await expect(equitySection).toBeVisible()

    // Period buttons should be present (check for at least some of: 7D, 30D, 90D, YTD, All)
    const periodButtons = equitySection.locator('button')
    const buttonTexts: string[] = []

    const count = await periodButtons.count()
    for (let i = 0; i < count; i++) {
      const text = await periodButtons.nth(i).textContent()
      if (text) buttonTexts.push(text.trim())
    }

    // At least some period selector buttons should be present
    const hasPeriodButton = buttonTexts.some((t) =>
      ['7D', '30D', '90D', 'YTD', 'All'].some((p) => t.includes(p)),
    )
    expect(hasPeriodButton, `Expected period buttons, found: ${buttonTexts.join(', ')}`).toBe(true)
  })

  test('renders chart container', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })

    const equitySection = page.locator('[aria-label="Equity and quick actions"]')
    await expect(equitySection).toBeVisible()

    // Chart container should exist (recharts renders SVG elements)
    const chartContainer = equitySection.locator('.recharts-wrapper, svg.recharts-surface, [class*="h-[320px]"]').first()
    await expect(chartContainer).toBeVisible({ timeout: 10_000 })
  })

  test('period button click triggers data reload', async ({ page }) => {
    let fetchCount = 0
    await page.route('**/api/members/dashboard/equity-curve*', async (route) => {
      fetchCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { date: '2026-02-01', cumulative_pnl: 100, drawdown: 0 },
            { date: '2026-02-15', cumulative_pnl: 250, drawdown: 0.02 },
          ],
        }),
      })
    })

    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' })

    const equitySection = page.locator('[aria-label="Equity and quick actions"]')
    await expect(equitySection).toBeVisible()

    // Wait for initial fetch
    await expect.poll(() => fetchCount, { timeout: 10_000 }).toBeGreaterThanOrEqual(1)

    const initialCount = fetchCount

    // Click a different period button
    const allButtons = equitySection.locator('button')
    const count = await allButtons.count()
    for (let i = 0; i < count; i++) {
      const text = await allButtons.nth(i).textContent()
      if (text && text.trim() === '7D') {
        await allButtons.nth(i).click()
        break
      }
    }

    // Should trigger another fetch
    await expect.poll(() => fetchCount, { timeout: 10_000 }).toBeGreaterThan(initialCount)
  })
})
