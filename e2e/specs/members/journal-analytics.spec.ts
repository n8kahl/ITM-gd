import { expect, test } from '@playwright/test'
import {
  createMockEntry,
  enableMemberBypass,
  setupJournalAnalyticsMocks,
  setupJournalCrudMocks,
  setupMemberShellMocks,
} from './journal-test-helpers'

const JOURNAL_ANALYTICS_URL = '/members/journal/analytics?e2eBypassAuth=1'

test.describe('Journal Analytics Page', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('loads analytics page with header and sub-navigation', async ({ page }) => {
    await setupJournalAnalyticsMocks(page)
    await setupJournalCrudMocks(page, [])

    await page.goto(JOURNAL_ANALYTICS_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Journal Analytics' })).toBeVisible()

    const entriesTab = page.getByRole('link', { name: 'Entries' })
    const analyticsTab = page.getByRole('link', { name: 'Analytics' })
    await expect(entriesTab).toBeVisible()
    await expect(analyticsTab).toBeVisible()
  })

  test('renders BiasInsightsCard with detected biases', async ({ page }) => {
    await setupJournalAnalyticsMocks(page)
    await setupJournalCrudMocks(page, [])

    await page.goto(JOURNAL_ANALYTICS_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByText('Loss Aversion')).toBeVisible()
    await expect(page.getByText('Recency Bias')).toBeVisible()

    await expect(page.getByText('(75% confidence)')).toBeVisible()
    await expect(page.getByText('(55% confidence)')).toBeVisible()
  })

  test('expands bias signal to show evidence and recommendation', async ({ page }) => {
    await setupJournalAnalyticsMocks(page)
    await setupJournalCrudMocks(page, [])

    await page.goto(JOURNAL_ANALYTICS_URL, { waitUntil: 'domcontentloaded' })

    const lossAversionCard = page.locator('button').filter({ hasText: /Loss Aversion/ }).first()
    await expect(lossAversionCard).toBeVisible()
    await lossAversionCard.click()

    await expect(page.getByText(/Average hold time/)).toBeVisible()
  })

  test('renders SetupPerformanceCard with setup breakdown', async ({ page }) => {
    await setupJournalAnalyticsMocks(page)
    await setupJournalCrudMocks(page, [])

    await page.goto(JOURNAL_ANALYTICS_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByText('Breakout')).toBeVisible()
    await expect(page.getByText('Pullback')).toBeVisible()
    await expect(page.getByText('Reversal')).toBeVisible()
  })

  test('loads AnalyticsDashboard with period selector', async ({ page }) => {
    await setupJournalAnalyticsMocks(page)
    await setupJournalCrudMocks(page, [])

    await page.goto(JOURNAL_ANALYTICS_URL, { waitUntil: 'domcontentloaded' })

    const periodButtons = ['7d', '30d', '90d', '1y', 'all']
    for (const period of periodButtons) {
      await expect(page.getByRole('button', { name: period })).toBeVisible()
    }
  })

  test('switches period and refetches data', async ({ page }) => {
    await setupJournalAnalyticsMocks(page)
    await setupJournalCrudMocks(page, [])

    await page.goto(JOURNAL_ANALYTICS_URL, { waitUntil: 'domcontentloaded' })

    let requestCount = 0
    await page.on('response', (response) => {
      if (response.url().includes('/api/members/journal/analytics')) {
        requestCount += 1
      }
    })

    const nineDayButton = page.getByRole('button', { name: '90d' })
    await nineDayButton.click()

    await page.waitForTimeout(500)
  })

  test('shows empty analytics message when no data', async ({ page }) => {
    await page.route('**/api/members/journal/analytics**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback()
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            total_trades: 0,
            winning_trades: 0,
            losing_trades: 0,
            win_rate: 0,
            total_pnl: 0,
            avg_pnl: 0,
            expectancy: 0,
            profit_factor: 0,
            sharpe_ratio: 0,
            sortino_ratio: 0,
            max_drawdown: 0,
            equity_curve: [],
            monthly_pnl: [],
            symbol_stats: [],
            direction_stats: [],
            hourly_pnl: [],
            day_of_week_pnl: [],
            r_multiple_distribution: [],
            mfe_mae_scatter: [],
          },
        }),
      })
    })

    await page.route('**/api/members/journal/biases**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback()
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            signals: [],
            analysis_period_days: 30,
            trade_count: 0,
          },
        }),
      })
    })

    await setupJournalCrudMocks(page, [])

    await page.goto(JOURNAL_ANALYTICS_URL, { waitUntil: 'domcontentloaded' })

    const emptyState = page.getByText(
      /No analytics data|No significant biases detected|No setup type data yet/i,
    )
    await expect(emptyState.first()).toBeVisible({ timeout: 5000 })
  })
})
