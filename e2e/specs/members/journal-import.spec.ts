import { expect, test, type Page } from '@playwright/test'
import {
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
  await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Import' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
}

test.describe('Trade Journal Import', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('imports CSV file successfully', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])
    await setupJournalImportMock(page, state)

    await openImportWizard(page)

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(csvFile('trades.csv', [
      'symbol,trade_date,entry_price',
      'AAPL,2026-02-01,100',
      'TSLA,2026-02-02,200',
    ].join('\n')))

    await expect(page.getByText('2 rows parsed. 0 rows currently invalid.')).toBeVisible()

    await page.getByRole('button', { name: 'Confirm Import' }).click()

    await expect(page.getByText('Import complete.')).toBeVisible()
    await expect(page.getByText('Inserted: 2')).toBeVisible()
    await expect(page.getByText('Duplicates: 0')).toBeVisible()
    await expect(page.getByText('Errors: 0')).toBeVisible()
  })

  test('shows preview before confirming import', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])
    await setupJournalImportMock(page, state)

    await openImportWizard(page)

    await page.locator('input[type="file"]').setInputFiles(csvFile('preview.csv', [
      'symbol,trade_date,entry_price',
      'MSFT,2026-01-15,310.5',
    ].join('\n')))

    await expect(page.getByText('1 rows parsed. 0 rows currently invalid.')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'symbol' })).toBeVisible()
    await expect(page.getByText('MSFT')).toBeVisible()
    await expect(page.getByText('Valid', { exact: true })).toBeVisible()
  })

  test('detects and reports duplicates on re-import', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])
    await setupJournalImportMock(page, state)

    const content = [
      'symbol,trade_date,entry_price',
      'QQQ,2026-02-03,500',
      'SPY,2026-02-03,600',
    ].join('\n')

    await openImportWizard(page)
    await page.locator('input[type="file"]').setInputFiles(csvFile('dupes.csv', content))
    await page.getByRole('button', { name: 'Confirm Import' }).click()

    await expect(page.getByText('Inserted: 2')).toBeVisible()

    await page.getByRole('button', { name: 'Import Another File' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.locator('input[type="file"]').setInputFiles(csvFile('dupes.csv', content))
    await page.getByRole('button', { name: 'Confirm Import' }).click()

    await expect(page.getByText('Inserted: 0')).toBeVisible()
    await expect(page.getByText('Duplicates: 2')).toBeVisible()
  })

  test('handles malformed CSV gracefully', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])
    await setupJournalImportMock(page, state)

    await openImportWizard(page)

    await page.locator('input[type="file"]').setInputFiles(csvFile('malformed.csv', ''))

    await expect(page.getByText('No CSV rows found in the selected file.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirm Import' })).not.toBeVisible()
  })
})
