import { expect, test } from '@playwright/test'
import {
  createMockEntry,
  enableMemberBypass,
  setupJournalCrudMocks,
  setupMemberShellMocks,
  type MockJournalEntry,
} from './journal-test-helpers'

const JOURNAL_URL = '/members/journal?e2eBypassAuth=1'

test.describe('DraftNotification Component', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('shows draft banner when draft entries exist', async ({ page }) => {
    // Create draft entries with is_draft and draft_status properties
    const draftEntry = createMockEntry({
      id: 'entry-draft-1',
      symbol: 'AAPL',
      is_open: true,
      exit_price: null,
      pnl: null,
      pnl_percentage: null,
      is_winner: null,
    }) as MockJournalEntry & { is_draft?: boolean; draft_status?: string }
    draftEntry.is_draft = true
    draftEntry.draft_status = 'pending'

    const state = await setupJournalCrudMocks(page, [draftEntry])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Verify draft banner is visible with count
    const draftBanner = page.getByText(/\d+\s+pending draft/i)
    await expect(draftBanner).toBeVisible()
    await expect(page.getByText(/1\s+pending draft/i)).toBeVisible()
  })

  test('shows latest draft symbol in banner', async ({ page }) => {
    // Create draft entry with NVDA symbol
    const draftEntry = createMockEntry({
      id: 'entry-draft-nvda',
      symbol: 'NVDA',
      is_open: true,
      exit_price: null,
      pnl: null,
      pnl_percentage: null,
      is_winner: null,
    }) as MockJournalEntry & { is_draft?: boolean; draft_status?: string }
    draftEntry.is_draft = true
    draftEntry.draft_status = 'pending'

    const state = await setupJournalCrudMocks(page, [draftEntry])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Verify banner shows NVDA symbol
    const draftBanner = page.getByText(/pending draft.*NVDA/i)
    await expect(draftBanner).toBeVisible({ timeout: 5000 })
    await expect(draftBanner).toContainText('NVDA')
  })

  test('dismisses draft banner', async ({ page }) => {
    // Create draft entry
    const draftEntry = createMockEntry({
      id: 'entry-draft-dismiss',
      symbol: 'TSLA',
      is_open: true,
      exit_price: null,
      pnl: null,
      pnl_percentage: null,
      is_winner: null,
    }) as MockJournalEntry & { is_draft?: boolean; draft_status?: string }
    draftEntry.is_draft = true
    draftEntry.draft_status = 'pending'

    const state = await setupJournalCrudMocks(page, [draftEntry])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Verify banner is visible
    const draftBanner = page.getByText(/pending draft/i)
    await expect(draftBanner).toBeVisible()

    // Find and click dismiss button (X icon or dismiss button)
    const dismissButton = page.locator('button[aria-label="Dismiss draft notification"], button:has-text("×"), [role="button"]:has-text("×")').first()
    if (await dismissButton.isVisible()) {
      await dismissButton.click()
    } else {
      // Alternative: look for close icon within the banner
      const banner = page.getByText(/pending draft/i).locator('..')
      const closeBtn = banner.locator('button').last()
      await closeBtn.click()
    }

    // Verify banner disappears
    await expect(draftBanner).not.toBeVisible()
  })

  test('shows no banner when no drafts exist', async ({ page }) => {
    // Create only non-draft entries
    const closedEntry = createMockEntry({
      id: 'entry-closed-1',
      symbol: 'SPY',
      entry_price: 450,
      exit_price: 455,
      position_size: 1,
      is_open: false,
      is_winner: true,
    })

    const state = await setupJournalCrudMocks(page, [closedEntry])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Verify no draft banner appears
    const draftBanner = page.getByText(/pending draft/i)
    await expect(draftBanner).not.toBeVisible()

    // Verify the entry is displayed instead
    await expect(page.getByText('SPY')).toBeVisible()
  })
})
