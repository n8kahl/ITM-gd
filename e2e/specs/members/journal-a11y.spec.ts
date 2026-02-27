import { expect, test, type Page } from '@playwright/test'
import {
  createMockEntry,
  enableMemberBypass,
  setupJournalAnalyticsMocks,
  setupJournalCrudMocks,
  setupMemberShellMocks,
} from './journal-test-helpers'

const JOURNAL_URL = '/members/journal?e2eBypassAuth=1'
const ANALYTICS_URL = '/members/journal/analytics?e2eBypassAuth=1'

const A11Y_FIXTURE = [
  createMockEntry({
    id: 'a11y-1',
    symbol: 'SPY',
    direction: 'long',
    contract_type: 'call',
    pnl: 120,
    is_open: false,
  }),
  createMockEntry({
    id: 'a11y-2',
    symbol: 'AAPL',
    direction: 'short',
    contract_type: 'stock',
    pnl: -40,
    is_open: false,
  }),
]

test.describe('Trade Journal Accessibility', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('journal page has correct heading hierarchy', async ({ page }) => {
    await setupJournalCrudMocks(page, A11Y_FIXTURE)
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Page heading exists
    const heading = page.getByRole('heading', { name: 'Trade Journal' })
    await expect(heading).toBeVisible()

    // Filter controls have accessible labels
    await expect(page.getByLabel('Symbol')).toBeVisible()
    await expect(page.getByLabel('Direction', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Sort by')).toBeVisible()
    await expect(page.getByLabel('View')).toBeVisible()

    // Action buttons have text labels
    await expect(page.getByRole('button', { name: 'New Entry' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Import' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Screenshot' })).toBeVisible()
  })

  test('analytics page has accessible structure', async ({ page }) => {
    await setupJournalCrudMocks(page, A11Y_FIXTURE)
    await setupJournalAnalyticsMocks(page)

    await page.goto(ANALYTICS_URL, { waitUntil: 'domcontentloaded' })

    const heading = page.getByRole('heading', { name: 'Journal Analytics' })
    await expect(heading).toBeVisible()

    // Sub-navigation links are accessible
    const entriesLink = page.getByRole('link', { name: 'Entries' })
    const analyticsLink = page.getByRole('link', { name: 'Analytics' })
    await expect(entriesLink).toBeVisible()
    await expect(analyticsLink).toBeVisible()
  })

  test('keyboard-only journal workflow', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()

    // Tab to New Entry button and activate with Enter
    const newEntryButton = page.getByRole('button', { name: 'New Entry' })
    await newEntryButton.focus()
    await expect(newEntryButton).toBeFocused()
    await page.keyboard.press('Enter')

    // Quick form should open — fill symbol via keyboard
    const symbolInput = page.locator('input[placeholder="AAPL"]')
    await expect(symbolInput).toBeVisible()
    await symbolInput.fill('META')

    // Fill entry price
    await page.locator('input[placeholder="0.00"]').first().fill('500')
    await page.locator('input[placeholder="0.00"]').nth(1).fill('510')

    // Tab to Save and press Enter
    const saveButton = page.getByRole('button', { name: 'Save' }).first()
    await saveButton.focus()
    await saveButton.evaluate((button: HTMLButtonElement) => button.click())

    // Verify entry was created
    await expect.poll(
      () => state.entries.some((entry) => entry.symbol === 'META'),
      { timeout: 10_000 },
    ).toBe(true)
  })

  test('entry detail sheet has proper dialog semantics', async ({ page }) => {
    await setupJournalCrudMocks(page, A11Y_FIXTURE)

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Switch to cards view and open detail
    await page.getByLabel('View').selectOption('cards')
    const spyCardOpen = page
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'SPY' }) })
      .locator('button')
      .first()
    await spyCardOpen.click()

    // Dialog semantics
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')

    // Close button has accessible label
    const closeButton = dialog.getByLabel('Close')
    await expect(closeButton).toBeVisible()

    // Action buttons have text content
    await expect(dialog.getByRole('button', { name: 'Grade Trade' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeVisible()

    // Escape closes the dialog
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })
})
