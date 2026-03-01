import { expect, test } from '@playwright/test'
import {
  createMockEntry,
  enableMemberBypass,
  setupJournalCrudMocks,
  setupMemberShellMocks,
} from './journal-test-helpers'

const JOURNAL_URL = '/members/journal?e2eBypassAuth=1'

test('redirects unauthenticated users to login', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/members/journal', { waitUntil: 'domcontentloaded' })
  await page.waitForURL(/\/login/)
  await expect(page).toHaveURL(/\/login/)
})

test.describe('Trade Journal V2', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('shows empty state when no entries exist', async ({ page }) => {
    await setupJournalCrudMocks(page, [])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
    await expect(page.getByText('Start tracking your edge')).toBeVisible()
    await expect(page.getByText('No journal entries found yet.')).toBeVisible()
  })

  test('creates entry via quick form', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: 'New Entry' }).click()
    await page.locator('input[placeholder="AAPL"]').fill('tsla')
    await page.locator('input[placeholder="0.00"]').first().fill('100')
    await page.locator('input[placeholder="0.00"]').nth(1).fill('103')
    const saveButton = page.getByRole('button', { name: 'Save' }).first()
    await expect(saveButton).toBeVisible()
    await saveButton.evaluate((button: HTMLButtonElement) => button.click())

    await expect.poll(
      () => state.entries.some((entry) => entry.symbol === 'TSLA'),
      { timeout: 10_000 },
    ).toBe(true)
  })

  test('creates entry via full form with all fields', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: 'New Entry' }).click()
    await page.getByRole('button', { name: 'Full Form' }).click()
    const tradeDialog = page.locator('[role="dialog"]').first()

    await page.locator('input[placeholder="AAPL"]').fill('MSFT')
    await tradeDialog.getByLabel('Direction', { exact: true }).click()
    await page.getByRole('option', { name: 'Short', exact: true }).click()
    await tradeDialog.getByLabel('Contract Type', { exact: true }).click()
    await page.getByRole('option', { name: 'Call', exact: true }).click()

    await page.locator('label', { hasText: 'Entry Price' }).locator('..').locator('input').fill('12.5')
    await page.locator('label', { hasText: 'Exit Price' }).locator('..').locator('input').fill('14.2')
    await page.locator('label', { hasText: 'Position Size' }).locator('..').locator('input').fill('2')
    await page.locator('summary').filter({ hasText: /^Risk Management$/ }).click()
    await page.locator('label', { hasText: 'Strategy' }).locator('..').locator('input').fill('Breakout Retest')

    const notesSummary = page.locator('summary').filter({ hasText: /^Notes & Lessons$/ })
    await notesSummary.scrollIntoViewIfNeeded()
    await notesSummary.click()

    await page.locator('label', { hasText: 'Setup Notes' }).locator('..').locator('textarea').fill('Breakout over prior day high.')
    await page.locator('label', { hasText: 'Execution Notes' }).locator('..').locator('textarea').fill('Entered on pullback with confirmation.')
    await page.locator('label', { hasText: 'Lessons Learned' }).locator('..').locator('textarea').fill('Scale out earlier near resistance.')

    const saveButton = page.getByRole('button', { name: 'Save' }).first()
    await expect(saveButton).toBeVisible()
    await saveButton.evaluate((button: HTMLButtonElement) => button.click())

    await expect.poll(
      () => state.entries.some((entry) => entry.symbol === 'MSFT' && entry.strategy === 'Breakout Retest'),
      { timeout: 10_000 },
    ).toBe(true)
  })

  test('edits existing entry', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [
      createMockEntry({
        id: 'entry-edit-1',
        symbol: 'AAPL',
        pnl: 50,
        pnl_percentage: 1.2,
      }),
    ])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    await page.getByLabel('View').click()
    await page.getByRole('option', { name: 'Cards', exact: true }).click()
    await page.getByRole('button', { name: 'Edit' }).first().click()

    await page.locator('label').filter({ hasText: /^P&L$/ }).locator('..').locator('input').first().fill('200')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect.poll(
      () => state.entries.find((entry) => entry.id === 'entry-edit-1')?.pnl,
      { timeout: 10_000 },
    ).toBe(200)
  })

  test('deletes entry with confirmation dialog', async ({ page }) => {
    await setupJournalCrudMocks(page, [
      createMockEntry({
        id: 'entry-delete-1',
        symbol: 'NVDA',
        pnl: -30,
      }),
    ])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    await page.getByLabel('View').click()
    await page.getByRole('option', { name: 'Cards', exact: true }).click()
    await page.getByRole('button', { name: 'Delete' }).first().click()

    await expect(page.getByText('Delete trade entry?')).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).nth(1).click()

    await expect(page.getByRole('heading', { name: 'NVDA' })).toHaveCount(0)
    await expect(page.getByText('Start tracking your edge')).toBeVisible()
  })

  test('cancel delete does not remove entry', async ({ page }) => {
    await setupJournalCrudMocks(page, [
      createMockEntry({
        id: 'entry-cancel-1',
        symbol: 'AMD',
        pnl: 15,
      }),
    ])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    await page.getByLabel('View').click()
    await page.getByRole('option', { name: 'Cards', exact: true }).click()
    await page.getByRole('button', { name: 'Delete' }).first().click()

    await expect(page.getByText('Delete trade entry?')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('heading', { name: 'AMD' })).toBeVisible()
  })

  test('shares a closed trade from entry detail sheet', async ({ page }) => {
    await setupJournalCrudMocks(page, [
      createMockEntry({
        id: 'entry-share-1',
        symbol: 'SPY',
        is_open: false,
        pnl: 125.5,
        pnl_percentage: 2.4,
      }),
    ])

    let shareRequestCount = 0
    await page.route('**/api/social/share-trade', async (route) => {
      shareRequestCount += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            feed_item: { id: 'feed-share-1' },
            trade_card: { id: 'trade-card-share-1' },
            image_url: 'https://example.com/trade-card.png',
            discord_share: {
              attempted: false,
              delivered: false,
              reason: 'Discord sharing not requested',
            },
          },
        }),
      })
    })

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    await page.getByLabel('Open SPY trade details').click()
    await page.getByRole('button', { name: 'Share' }).click()

    await expect(page.getByRole('heading', { name: 'Share Trade' })).toBeVisible()
    await page.getByRole('button', { name: 'Share Trade' }).click()

    await expect(page.getByText('Trade shared successfully!')).toBeVisible()
    await expect.poll(() => shareRequestCount, { timeout: 10_000 }).toBe(1)
  })

  test('shows trade screenshot in entry detail sheet with zoom', async ({ page }) => {
    await setupJournalCrudMocks(page, [
      createMockEntry({
        id: 'entry-screenshot-1',
        symbol: 'QQQ',
        screenshot_url: '/logo.png',
      }),
    ])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    await page.getByLabel('Open QQQ trade details').click()
    await expect(page.getByAltText('QQQ trade screenshot')).toBeVisible()

    await page.getByAltText('QQQ trade screenshot').click()
    await expect(page.getByAltText('QQQ trade screenshot full size')).toBeVisible()
    await page.getByLabel('Close screenshot zoom').click()
  })
})
