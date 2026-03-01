import { expect, test, type Page } from '@playwright/test'
import {
  createMockEntry,
  enableMemberBypass,
  setupJournalCrudMocks,
  setupMemberShellMocks,
} from './journal-test-helpers'

const JOURNAL_URL = '/members/journal?e2eBypassAuth=1'

const FILTER_FIXTURE = [
  createMockEntry({
    id: 'entry-1',
    symbol: 'AAPL',
    direction: 'long',
    trade_date: '2026-02-01T14:30:00.000Z',
    pnl: 120,
    pnl_percentage: 1.2,
  }),
  createMockEntry({
    id: 'entry-2',
    symbol: 'TSLA',
    direction: 'short',
    trade_date: '2026-02-05T14:30:00.000Z',
    pnl: -80,
    pnl_percentage: -0.8,
  }),
  createMockEntry({
    id: 'entry-3',
    symbol: 'MSFT',
    direction: 'long',
    trade_date: '2026-02-10T14:30:00.000Z',
    pnl: 40,
    pnl_percentage: 0.4,
  }),
]

async function openWithFixtures(page: Page) {
  await setupJournalCrudMocks(page, FILTER_FIXTURE)
  await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
}

function firstRowSymbol(page: Page) {
  return page
    .locator('table[aria-label="Journal trades table"] tbody tr')
    .first()
    .locator('td')
    .nth(1)
}

async function pickFilterDate(page: Page, label: 'Start date' | 'End date', day: number) {
  await page.getByLabel(label).click()

  const previousMonthButton = page.getByRole('button', { name: /previous month/i })
  const targetDateRegex = new RegExp(`February\\s+${day}.*2026`, 'i')

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const targetDay = page.getByRole('button', { name: targetDateRegex })
    if (await targetDay.count()) {
      await targetDay.first().click()
      return
    }
    await previousMonthButton.click()
  }

  throw new Error(`Unable to select February ${day}, 2026 in ${label} picker`)
}

test.describe('Trade Journal Filters', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('filters by date range', async ({ page }) => {
    await openWithFixtures(page)

    await pickFilterDate(page, 'Start date', 4)
    await pickFilterDate(page, 'End date', 6)

    await expect(page.getByText('TSLA')).toBeVisible()
    await expect(page.getByText('AAPL')).not.toBeVisible()
    await expect(page.getByText('MSFT')).not.toBeVisible()
  })

  test('filters by symbol', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('Symbol').fill('ms')

    await expect(page.getByText('MSFT')).toBeVisible()
    await expect(page.getByText('AAPL')).not.toBeVisible()
    await expect(page.getByText('TSLA')).not.toBeVisible()
  })

  test('filters by direction', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('Direction', { exact: true }).click()
    await page.getByRole('option', { name: 'Short', exact: true }).click()

    await expect(page.getByText('TSLA')).toBeVisible()
    await expect(page.getByText('AAPL')).not.toBeVisible()
    await expect(page.getByText('MSFT')).not.toBeVisible()
  })

  test('filters by win/loss', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('Win/loss').click()
    await page.getByRole('option', { name: 'Losers', exact: true }).click()

    await expect(page.getByText('TSLA')).toBeVisible()
    await expect(page.getByText('AAPL')).not.toBeVisible()
    await expect(page.getByText('MSFT')).not.toBeVisible()
  })

  test('sorts by P&L ascending and descending', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('Sort by').click()
    await page.getByRole('option', { name: 'Sort: P&L', exact: true }).click()
    await page.getByLabel('Sort direction').click()
    await page.getByRole('option', { name: 'Ascending', exact: true }).click()

    await expect(firstRowSymbol(page)).toHaveText('TSLA')

    await page.getByLabel('Sort direction').click()
    await page.getByRole('option', { name: 'Descending', exact: true }).click()

    await expect(firstRowSymbol(page)).toHaveText('AAPL')
  })

  test('clear all resets filters', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('Symbol').fill('AAPL')
    await expect(page.getByText('AAPL')).toBeVisible()
    await expect(page.getByText('TSLA')).not.toBeVisible()

    await page.getByRole('button', { name: 'Clear all' }).click()

    await expect(page.getByLabel('Symbol')).toHaveValue('')
    await expect(page.getByText('AAPL')).toBeVisible()
    await expect(page.getByText('TSLA')).toBeVisible()
    await expect(page.getByText('MSFT')).toBeVisible()
  })
})
