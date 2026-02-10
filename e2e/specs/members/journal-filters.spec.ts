import { expect, test, type Page } from '@playwright/test'
import {
  createMockEntry,
  enableMemberBypass,
  setupJournalCrudMocks,
  setupMemberShellMocks,
} from './journal-test-helpers'

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
  await page.goto('/members/journal', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
}

function firstRowSymbol(page: Page) {
  return page
    .locator('table[aria-label="Journal trades table"] tbody tr')
    .first()
    .locator('td')
    .nth(1)
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

    await page.getByLabel('Start date').fill('2026-02-04')
    await page.getByLabel('End date').fill('2026-02-06')

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

    await page.getByLabel('Direction', { exact: true }).selectOption('short')

    await expect(page.getByText('TSLA')).toBeVisible()
    await expect(page.getByText('AAPL')).not.toBeVisible()
    await expect(page.getByText('MSFT')).not.toBeVisible()
  })

  test('filters by win/loss', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('Win/loss').selectOption('false')

    await expect(page.getByText('TSLA')).toBeVisible()
    await expect(page.getByText('AAPL')).not.toBeVisible()
    await expect(page.getByText('MSFT')).not.toBeVisible()
  })

  test('sorts by P&L ascending and descending', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('Sort by').selectOption('pnl')
    await page.getByLabel('Sort direction').selectOption('asc')

    await expect(firstRowSymbol(page)).toHaveText('TSLA')

    await page.getByLabel('Sort direction').selectOption('desc')

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
