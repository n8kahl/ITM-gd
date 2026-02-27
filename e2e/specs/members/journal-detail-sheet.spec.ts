import { expect, test } from '@playwright/test'
import {
  createMockEntry,
  createMockAIAnalysis,
  createMockFavoriteEntry,
  enableMemberBypass,
  setupJournalCrudMocks,
  setupMemberShellMocks,
  type MockJournalEntry,
} from './journal-test-helpers'

const JOURNAL_URL = '/members/journal?e2eBypassAuth=1'

test.describe('Entry Detail Sheet', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('opens detail sheet from entry card', async ({ page }) => {
    // Create a closed entry for card view
    const entry = createMockEntry({
      id: 'entry-open-detail-1',
      symbol: 'SPY',
      direction: 'long',
      contract_type: 'stock',
      entry_price: 450,
      exit_price: 455,
      position_size: 1,
      is_open: false,
    })

    await setupJournalCrudMocks(page, [entry])

    // Navigate to journal
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Switch to cards view if needed
    const cardsViewButton = page.locator('button[aria-label*="card" i], button[aria-label*="Card" i]').first()
    if (await cardsViewButton.isVisible()) {
      await cardsViewButton.click()
    }

    // Click on entry label to open detail sheet
    const entryLabel = page.getByLabel('Open SPY trade details')
    await expect(entryLabel).toBeVisible({ timeout: 5000 })
    await entryLabel.click()

    // Verify dialog appears
    const dialog = page.locator('[role="dialog"][aria-modal="true"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Verify symbol heading is visible
    const symbolHeading = page.locator('h2, h3, [data-testid="detail-sheet-heading"]').filter({ hasText: /SPY/ }).first()
    await expect(symbolHeading).toBeVisible()
  })

  test('displays all entry fields in detail view', async ({ page }) => {
    // Create entry with all fields populated
    const entry = createMockEntry({
      id: 'entry-all-fields-1',
      symbol: 'AAPL',
      direction: 'long',
      contract_type: 'stock',
      entry_price: 150,
      exit_price: 155,
      position_size: 1,
      strategy: 'Breakout Strategy',
      setup_notes: 'Found support at 148',
      execution_notes: 'Entered on break of 150.50',
      lessons_learned: 'Need to wait for volume confirmation',
      tags: ['breakout', 'technical'],
      is_open: false,
    })

    await setupJournalCrudMocks(page, [entry])

    // Navigate to journal
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Click on entry to open detail sheet
    const entryLabel = page.getByLabel('Open AAPL trade details')
    await expect(entryLabel).toBeVisible({ timeout: 5000 })
    await entryLabel.click()

    // Verify dialog is open
    const dialog = page.locator('[role="dialog"][aria-modal="true"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Verify all text fields are visible
    await expect(dialog.getByText('Breakout Strategy')).toBeVisible()
    await expect(dialog.getByText('Found support at 148')).toBeVisible()
    await expect(dialog.getByText('Entered on break of 150.50')).toBeVisible()
    await expect(dialog.getByText('Need to wait for volume confirmation')).toBeVisible()

    // Verify tags are visible
    await expect(dialog.getByText('breakout', { exact: true })).toBeVisible()
    await expect(dialog.getByText('technical', { exact: true })).toBeVisible()
  })

  test('shows Share button only for closed trades with P&L', async ({ page }) => {
    // Create closed entry with P&L
    const closedWithPnL = createMockEntry({
      id: 'entry-closed-pnl-1',
      symbol: 'QQQ',
      direction: 'long',
      contract_type: 'stock',
      entry_price: 360,
      exit_price: 365,
      position_size: 1,
      is_open: false,
    })

    // Create open entry without P&L
    const openEntry = createMockEntry({
      id: 'entry-open-no-pnl-1',
      symbol: 'MSFT',
      direction: 'long',
      contract_type: 'stock',
      entry_price: 380,
      exit_price: null,
      position_size: 1,
      pnl: null,
      is_open: true,
    })

    await setupJournalCrudMocks(page, [closedWithPnL, openEntry])

    // Navigate to journal
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Test closed entry with P&L - Share button should be visible
    const closedLabel = page.getByLabel('Open QQQ trade details')
    await expect(closedLabel).toBeVisible({ timeout: 5000 })
    await closedLabel.click()

    // Verify Share button exists for closed trade
    const shareButton = page.locator('button:has-text("Share"), [aria-label*="Share" i]').filter({ visible: true })
    await expect(shareButton).toBeVisible({ timeout: 5000 })

    // Close the detail sheet
    const closeButton = page.locator('[aria-label="Close"]').first()
    await closeButton.click()
    await page.locator('[role="dialog"][aria-modal="true"]').waitFor({ state: 'hidden', timeout: 5000 })

    // Test open entry - Share button should NOT be visible
    const openLabel = page.getByLabel('Open MSFT trade details')
    await expect(openLabel).toBeVisible({ timeout: 5000 })
    await openLabel.click()

    // Verify Share button is NOT visible for open trade
    const shareButtonOnOpen = page.locator('button:has-text("Share"), [aria-label*="Share" i]')
    await expect(shareButtonOnOpen).not.toBeVisible()
  })

  test('shows Grade Trade button for ungraded entry', async ({ page }) => {
    // Create ungraded entry (no ai_analysis)
    const ungradedEntry = createMockEntry({
      id: 'entry-ungraded-1',
      symbol: 'TSLA',
      direction: 'short',
      contract_type: 'stock',
      entry_price: 250,
      exit_price: 245,
      position_size: 1,
      ai_analysis: null,
      is_open: false,
    })

    await setupJournalCrudMocks(page, [ungradedEntry])

    // Navigate to journal
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Click on entry to open detail sheet
    const entryLabel = page.getByLabel('Open TSLA trade details')
    await expect(entryLabel).toBeVisible({ timeout: 5000 })
    await entryLabel.click()

    // Verify dialog is open
    const dialog = page.locator('[role="dialog"][aria-modal="true"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Verify "Grade Trade" button is visible
    const gradeTradeButton = page.locator('button:has-text("Grade Trade")')
    await expect(gradeTradeButton).toBeVisible()

    // Verify button is enabled
    const isDisabled = await gradeTradeButton.isDisabled()
    expect(isDisabled).toBe(false)
  })

  test('shows Graded button (disabled) for graded entry', async ({ page }) => {
    // Create entry with AI analysis
    const aiAnalysis = createMockAIAnalysis('B')
    const gradedEntry = createMockEntry({
      id: 'entry-graded-1',
      symbol: 'NVDA',
      direction: 'long',
      contract_type: 'stock',
      entry_price: 875,
      exit_price: 885,
      position_size: 1,
      ai_analysis: aiAnalysis,
      is_open: false,
    })

    await setupJournalCrudMocks(page, [gradedEntry])

    // Navigate to journal
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Click on entry to open detail sheet
    const entryLabel = page.getByLabel('Open NVDA trade details')
    await expect(entryLabel).toBeVisible({ timeout: 5000 })
    await entryLabel.click()

    // Verify dialog is open
    const dialog = page.locator('[role="dialog"][aria-modal="true"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Verify "Graded" button exists and is disabled
    const gradedButton = page.locator('button:has-text("Graded"), button[disabled]:has-text("Graded")')
    await expect(gradedButton).toBeVisible()

    // Verify button is disabled
    const isDisabled = await gradedButton.isDisabled()
    expect(isDisabled).toBe(true)
  })

  test('closes detail sheet with Escape key', async ({ page }) => {
    // Create an entry
    const entry = createMockEntry({
      id: 'entry-escape-close-1',
      symbol: 'IBM',
      direction: 'long',
      contract_type: 'stock',
      entry_price: 185,
      exit_price: 190,
      position_size: 1,
      is_open: false,
    })

    await setupJournalCrudMocks(page, [entry])

    // Navigate to journal
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Click on entry to open detail sheet
    const entryLabel = page.getByLabel('Open IBM trade details')
    await expect(entryLabel).toBeVisible({ timeout: 5000 })
    await entryLabel.click()

    // Verify dialog is open
    const dialog = page.locator('[role="dialog"][aria-modal="true"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Press Escape key
    await page.keyboard.press('Escape')

    // Verify dialog disappears
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })

  test('closes detail sheet with Close button', async ({ page }) => {
    // Create an entry
    const entry = createMockEntry({
      id: 'entry-button-close-1',
      symbol: 'GE',
      direction: 'short',
      contract_type: 'stock',
      entry_price: 100,
      exit_price: 98,
      position_size: 1,
      is_open: false,
    })

    await setupJournalCrudMocks(page, [entry])

    // Navigate to journal
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Click on entry to open detail sheet
    const entryLabel = page.getByLabel('Open GE trade details')
    await expect(entryLabel).toBeVisible({ timeout: 5000 })
    await entryLabel.click()

    // Verify dialog is open
    const dialog = page.locator('[role="dialog"][aria-modal="true"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Click Close button with aria-label="Close"
    const closeButton = page.locator('[aria-label="Close"]').first()
    await expect(closeButton).toBeVisible()
    await closeButton.click()

    // Verify dialog disappears
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })
})
