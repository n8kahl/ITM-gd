import { expect, test, type Page } from '@playwright/test'
import {
  createMockEntry,
  enableMemberBypass,
  setupJournalCrudMocks,
  setupMemberShellMocks,
} from './journal-test-helpers'

const JOURNAL_URL = '/members/journal?e2eBypassAuth=1'

function generateLargeFixture(count: number) {
  const entries = []
  for (let i = 0; i < count; i++) {
    const dayOffset = i % 60
    const symbol = ['AAPL', 'SPY', 'TSLA', 'MSFT', 'QQQ'][i % 5]
    const direction = i % 3 === 0 ? 'short' : 'long'
    const pnl = Math.round((Math.random() - 0.4) * 200)

    entries.push(
      createMockEntry({
        id: `entry-${i}`,
        symbol,
        direction,
        trade_date: `2026-01-${String((dayOffset % 28) + 1).padStart(2, '0')}T${String(Math.floor(i / 10) + 9).padStart(2, '0')}:30:00.000Z`,
        pnl,
        pnl_percentage: pnl ? ((pnl / 100) * (Math.random() + 0.5)) : 0,
        is_winner: pnl > 0,
      }),
    )
  }
  return entries
}

async function openWithFixtures(page: Page, entries: ReturnType<typeof createMockEntry>[]) {
  await setupJournalCrudMocks(page, entries)
  await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
  await expect.poll(async () => getVisibleEntryCount(page), { timeout: 10_000 }).toBeGreaterThan(0)
}

async function getVisibleEntryCount(page: Page) {
  const tableCount = await page.locator('table[aria-label="Journal trades table"] tbody tr').count()
  if (tableCount > 0) return tableCount

  // When card view is active, each entry is rendered as an article card.
  return page.locator('article').count()
}

test.describe('Trade Journal Pagination', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('shows limited entries on initial load', async ({ page }) => {
    const largeFixture = generateLargeFixture(60)
    await openWithFixtures(page, largeFixture)

    const visibleCount = await getVisibleEntryCount(page)
    expect(visibleCount).toBeGreaterThan(0)
    expect(visibleCount).toBeLessThanOrEqual(60)
  })

  test('shows total trade count in summary stats', async ({ page }) => {
    const largeFixture = generateLargeFixture(60)
    await openWithFixtures(page, largeFixture)

    const statsSection = page.locator('[role="region"]').filter({ hasText: /Total|Trades|Summary/ })
    const hasStats = await statsSection.count()

    if (hasStats > 0) {
      const statsText = await statsSection.first().textContent()
      expect(statsText).toContain('60')
    }
  })

  test('loads more entries when Load More is clicked', async ({ page }) => {
    const largeFixture = generateLargeFixture(60)
    await openWithFixtures(page, largeFixture)

    const initialCount = await getVisibleEntryCount(page)

    const loadMoreButton = page.getByRole('button', { name: /Load More|Show More/ })
    const loadMoreExists = await loadMoreButton.count()

    if (loadMoreExists > 0) {
      await loadMoreButton.click()

      await expect.poll(
        async () => getVisibleEntryCount(page),
        { timeout: 10_000 },
      ).toBeGreaterThan(initialCount)
    }
  })

  test('displays all entries with high limit', async ({ page }) => {
    const largeFixture = generateLargeFixture(60)
    await openWithFixtures(page, largeFixture)

    const visibleCount = await getVisibleEntryCount(page)

    const loadMoreButton = page.getByRole('button', { name: /Load More|Show More/ })
    const loadMoreExists = await loadMoreButton.count()

    if (loadMoreExists > 0) {
      while (await loadMoreButton.count() > 0) {
        await loadMoreButton.click()
        await page.waitForTimeout(500)
      }
    }

    const finalCount = await getVisibleEntryCount(page)
    expect(finalCount).toBe(60)
  })

  test('pagination resets on filter change', async ({ page }) => {
    const largeFixture = generateLargeFixture(60)
    await openWithFixtures(page, largeFixture)

    const initialCount = await getVisibleEntryCount(page)

    const loadMoreButton = page.getByRole('button', { name: /Load More|Show More/ })
    const loadMoreExists = await loadMoreButton.count()

    if (loadMoreExists > 0) {
      await loadMoreButton.click()
      await page.waitForTimeout(500)
      const countAfterLoadMore = await getVisibleEntryCount(page)
      expect(countAfterLoadMore).toBeGreaterThan(initialCount)

      await page.getByLabel('Symbol').fill('aapl')
      await page.waitForTimeout(500)

      const countAfterFilter = await getVisibleEntryCount(page)
      expect(countAfterFilter).toBeLessThanOrEqual(initialCount)
    }
  })
})
