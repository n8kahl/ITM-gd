import { expect, test, type Page } from '@playwright/test'
import {
  createMockEntry,
  enableMemberBypass,
  setupJournalCrudMocks,
  setupJournalImportMock,
  setupMemberShellMocks,
} from './journal-test-helpers'

const JOURNAL_URL = '/members/journal?e2eBypassAuth=1'

function csvFile(name: string, content: string) {
  return {
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf-8'),
  }
}

async function openImportWizard(page: Page) {
  await page.getByRole('button', { name: 'Import' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
}

test.describe('Trade Journal Mobile', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('forces card view on narrow viewports and keeps filters usable', async ({ page }) => {
    await setupJournalCrudMocks(page, [
      createMockEntry({ id: 'mobile-1', symbol: 'AAPL', pnl: 120 }),
      createMockEntry({ id: 'mobile-2', symbol: 'TSLA', pnl: -40 }),
    ])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
    await expect(page.getByLabel('View')).toHaveValue('cards')
    await expect(page.locator('table[aria-label="Journal trades table"]')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'AAPL' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'TSLA' })).toBeVisible()

    await page.getByLabel('Symbol').fill('tsla')
    await expect(page.getByRole('heading', { name: 'TSLA' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'AAPL' })).toHaveCount(0)
  })

  test('creates a quick entry from mobile layout', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: 'New Entry' }).click()
    await page.locator('input[placeholder="AAPL"]').fill('nvda')
    await page.locator('input[placeholder="0.00"]').first().fill('800')
    await page.locator('input[placeholder="0.00"]').nth(1).fill('810')
    await page.getByRole('button', { name: 'Save' }).first().click()

    await expect.poll(
      () => state.entries.some((entry) => entry.symbol === 'NVDA'),
      { timeout: 10_000 },
    ).toBe(true)

    await expect(page.getByRole('heading', { name: 'NVDA' })).toBeVisible()
  })

  test('imports CSV in batches on mobile workflow', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])
    await setupJournalImportMock(page, state)

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })
    await openImportWizard(page)

    const rows = Array.from({ length: 505 }, (_, index) => {
      return `SYM${index},2026-02-01,${100 + index}`
    })
    const content = ['symbol,trade_date,entry_price', ...rows].join('\n')

    await page.locator('input[type="file"]').setInputFiles(csvFile('mobile-batch.csv', content))

    await expect(page.getByText('Import will run in 2 batches.')).toBeVisible()
    await page.getByRole('button', { name: 'Confirm Import' }).click()

    await expect(page.getByText('Import complete.')).toBeVisible()
    await expect(page.getByText('Inserted: 505')).toBeVisible()
    await expect(page.getByText('Duplicates: 0')).toBeVisible()
  })
})
