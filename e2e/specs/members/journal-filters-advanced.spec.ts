import { expect, test, type Page } from '@playwright/test'
import {
  createMockEntry,
  enableMemberBypass,
  setupJournalCrudMocks,
  setupMemberShellMocks,
} from './journal-test-helpers'

const JOURNAL_URL = '/members/journal?e2eBypassAuth=1'

const ADVANCED_FILTER_FIXTURE = [
  createMockEntry({
    id: 'entry-call-1',
    symbol: 'AAPL',
    direction: 'long',
    contract_type: 'call',
    trade_date: '2026-02-01T14:30:00.000Z',
    entry_price: 3.5,
    exit_price: 5.2,
    pnl: 170,
    pnl_percentage: 1.7,
    is_open: false,
  }),
  createMockEntry({
    id: 'entry-call-2',
    symbol: 'SPY',
    direction: 'short',
    contract_type: 'call',
    trade_date: '2026-02-02T14:30:00.000Z',
    entry_price: 2.1,
    exit_price: 1.8,
    pnl: 30,
    pnl_percentage: 0.3,
    is_open: false,
  }),
  createMockEntry({
    id: 'entry-put-1',
    symbol: 'TSLA',
    direction: 'long',
    contract_type: 'put',
    trade_date: '2026-02-03T14:30:00.000Z',
    entry_price: 4.0,
    exit_price: 3.2,
    pnl: -80,
    pnl_percentage: -0.8,
    is_open: false,
  }),
  createMockEntry({
    id: 'entry-stock-1',
    symbol: 'MSFT',
    direction: 'long',
    contract_type: 'stock',
    trade_date: '2026-02-04T14:30:00.000Z',
    entry_price: 420.0,
    exit_price: 425.5,
    pnl: 550,
    pnl_percentage: 1.31,
    is_open: true,
  }),
  createMockEntry({
    id: 'entry-stock-2',
    symbol: 'SPY',
    direction: 'short',
    contract_type: 'stock',
    trade_date: '2026-02-05T14:30:00.000Z',
    entry_price: 500.0,
    exit_price: 495.0,
    pnl: 500,
    pnl_percentage: 1.0,
    is_open: false,
  }),
  createMockEntry({
    id: 'entry-open-1',
    symbol: 'QQQ',
    direction: 'long',
    contract_type: 'stock',
    trade_date: '2026-02-06T14:30:00.000Z',
    entry_price: 380.0,
    exit_price: null,
    pnl: null,
    pnl_percentage: null,
    is_open: true,
    is_winner: null,
  }),
]

async function openWithFixtures(page: Page) {
  await setupJournalCrudMocks(page, ADVANCED_FILTER_FIXTURE)
  await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
}

function getVisibleSymbols(page: Page) {
  return page
    .locator('table[aria-label="Journal trades table"] tbody tr td:nth-child(2)')
    .allTextContents()
}

test.describe('Trade Journal Advanced Filters', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('filters by contract type', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('Contract type').selectOption('call')

    await expect(page.getByText('AAPL')).toBeVisible()
    await expect(page.getByText('SPY')).toBeVisible()
    await expect(page.getByText('TSLA')).not.toBeVisible()
    await expect(page.getByText('MSFT')).not.toBeVisible()
    await expect(page.getByText('QQQ')).not.toBeVisible()
  })

  test('filters by open/closed status', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('Open/closed').selectOption('true')

    await expect(page.getByText('MSFT')).toBeVisible()
    await expect(page.getByText('QQQ')).toBeVisible()
    await expect(page.getByText('AAPL')).not.toBeVisible()
    await expect(page.getByText('SPY')).not.toBeVisible()
    await expect(page.getByText('TSLA')).not.toBeVisible()
  })

  test('combines symbol and direction filters', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('Symbol').fill('spy')
    await page.getByLabel('Direction', { exact: true }).selectOption('short')

    await expect(page.getByText('SPY')).toBeVisible()
    await expect(page.getByText('AAPL')).not.toBeVisible()
    await expect(page.getByText('TSLA')).not.toBeVisible()
    await expect(page.getByText('MSFT')).not.toBeVisible()
    await expect(page.getByText('QQQ')).not.toBeVisible()
  })

  test('combines multiple filters simultaneously', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('Symbol').fill('spy')
    await page.getByLabel('Direction', { exact: true }).selectOption('short')
    await page.getByLabel('Contract type').selectOption('stock')
    await page.getByLabel('Win/loss').selectOption('true')

    await expect(page.getByText('SPY')).toBeVisible()
    await expect(page.getByText('AAPL')).not.toBeVisible()
    await expect(page.getByText('TSLA')).not.toBeVisible()
    await expect(page.getByText('MSFT')).not.toBeVisible()
    await expect(page.getByText('QQQ')).not.toBeVisible()
  })

  test('filters reset when clear all clicked', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('Symbol').fill('aapl')
    await page.getByLabel('Direction', { exact: true }).selectOption('long')
    await page.getByLabel('Contract type').selectOption('call')

    await expect(page.getByText('AAPL')).toBeVisible()
    await expect(page.getByText('SPY')).not.toBeVisible()

    await page.getByRole('button', { name: 'Clear all' }).click()

    await expect(page.getByLabel('Symbol')).toHaveValue('')
    await expect(page.getByLabel('Direction', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('Contract type')).toHaveValue('')

    await expect(page.getByText('AAPL')).toBeVisible()
    await expect(page.getByText('SPY')).toBeVisible()
    await expect(page.getByText('TSLA')).toBeVisible()
    await expect(page.getByText('MSFT')).toBeVisible()
    await expect(page.getByText('QQQ')).toBeVisible()
  })

  test('table view shows correct column headers', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('View').selectOption('table')

    const table = page.locator('table[aria-label="Journal trades table"]')
    await expect(table).toBeVisible()

    const headers = await table.locator('thead th').allTextContents()
    expect(headers).toContain('Date')
    expect(headers).toContain('Symbol')
    expect(headers).toContain('Direction')
    expect(headers).toContain('Type')
    expect(headers).toContain('Entry')
    expect(headers).toContain('Exit')
    expect(headers).toContain('P&L')
  })

  test('no results shows empty state message', async ({ page }) => {
    await openWithFixtures(page)

    await page.getByLabel('Symbol').fill('NONEXISTENT')

    await expect(page.getByText('No journal entries found')).toBeVisible()
    await expect(page.locator('table[aria-label="Journal trades table"]')).not.toBeVisible()
  })
})
