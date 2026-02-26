import { expect, test } from '@playwright/test'
import {
  createMockEntry,
  enableMemberBypass,
  setupJournalCrudMocks,
  setupMemberShellMocks,
} from './journal-test-helpers'

const JOURNAL_URL = '/members/journal?e2eBypassAuth=1'

test.describe('Psychology Prompt', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('shows psychology prompt card for recently closed trade', async ({ page }) => {
    // Create a mock entry with is_open=false (recently closed trade)
    const closedTrade = createMockEntry({
      id: 'entry-psychology-1',
      symbol: 'SPY',
      is_open: false,
      entry_price: 450.00,
      exit_price: 452.50,
      pnl: 2.50,
    })

    await setupJournalCrudMocks(page, [closedTrade])
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Verify the psychology prompt card appears with Brain icon or text
    const promptCard = page.locator('button').filter({ hasText: /How did you feel during/ })
    await expect(promptCard).toBeVisible()

    // Verify the Brain icon is present
    const brainIcon = promptCard.locator('[data-lucide="brain"]')
    await expect(brainIcon).toBeVisible()

    // Verify the symbol is displayed
    await expect(promptCard).toContainText('SPY')
  })

  test('expands prompt to show mood selection', async ({ page }) => {
    const closedTrade = createMockEntry({
      id: 'entry-psychology-2',
      symbol: 'AAPL',
      is_open: false,
      entry_price: 180.00,
      exit_price: 185.00,
      pnl: 5.00,
    })

    await setupJournalCrudMocks(page, [closedTrade])
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Click the prompt card to expand
    const promptCard = page.locator('button').filter({ hasText: /How did you feel during/ })
    await promptCard.click()

    // Verify the expanded card is visible with title
    await expect(page.getByText('Post-Trade Reflection')).toBeVisible()

    // Verify all mood buttons are visible
    const moodLabels = ['Confident', 'Neutral', 'Anxious', 'Frustrated', 'Excited', 'Fearful']
    for (const mood of moodLabels) {
      const button = page.getByRole('button').filter({ hasText: mood })
      await expect(button).toBeVisible()
    }

    // Verify discipline score buttons (1-5)
    const disciplineLabels = ['Poor', 'Below Avg', 'Average', 'Good', 'Excellent']
    for (const label of disciplineLabels) {
      const button = page.getByRole('button').filter({ hasText: label })
      await expect(button).toBeVisible()
    }

    // Verify followed plan options
    await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'No' })).toBeVisible()

    // Verify Save button is visible
    await expect(page.getByRole('button', { name: /Save Reflection/ })).toBeVisible()
  })

  test('selects mood before and mood after', async ({ page }) => {
    const closedTrade = createMockEntry({
      id: 'entry-psychology-3',
      symbol: 'TSLA',
      is_open: false,
      entry_price: 240.00,
      exit_price: 245.00,
      pnl: 5.00,
    })

    await setupJournalCrudMocks(page, [closedTrade])
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Expand the prompt
    const promptCard = page.locator('button').filter({ hasText: /How did you feel during/ })
    await promptCard.click()

    // Select "Confident" for mood before
    const confidentButtons = page.getByRole('button').filter({ hasText: 'Confident' })
    const confidentBefore = confidentButtons.first()
    await confidentBefore.click()

    // Verify the button is highlighted (has the amber styling)
    await expect(confidentBefore).toHaveClass(/bg-amber-500/)

    // Select "Neutral" for mood after by clicking the second occurrence in the mood after section
    const neutralButtons = page.getByRole('button').filter({ hasText: 'Neutral' })
    const neutralAfter = neutralButtons.last()
    await neutralAfter.click()

    // Verify the button is highlighted
    await expect(neutralAfter).toHaveClass(/bg-amber-500/)
  })

  test('selects discipline score', async ({ page }) => {
    const closedTrade = createMockEntry({
      id: 'entry-psychology-4',
      symbol: 'QQQ',
      is_open: false,
      entry_price: 350.00,
      exit_price: 353.00,
      pnl: 3.00,
    })

    await setupJournalCrudMocks(page, [closedTrade])
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Expand the prompt
    const promptCard = page.locator('button').filter({ hasText: /How did you feel during/ })
    await promptCard.click()

    // Select "Good" discipline score (4)
    const goodButton = page.getByRole('button').filter({ hasText: /^4 — Good$/ })
    await goodButton.click()

    // Verify the button is highlighted
    await expect(goodButton).toHaveClass(/bg-amber-500/)
  })

  test('saves psychology data via PATCH', async ({ page }) => {
    const closedTrade = createMockEntry({
      id: 'entry-psychology-5',
      symbol: 'MSFT',
      is_open: false,
      entry_price: 400.00,
      exit_price: 405.00,
      pnl: 5.00,
      mood_before: null,
      mood_after: null,
      discipline_score: null,
      followed_plan: null,
    })

    const state = await setupJournalCrudMocks(page, [closedTrade])
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Expand the prompt
    const promptCard = page.locator('button').filter({ hasText: /How did you feel during/ })
    await promptCard.click()

    // Select mood before: Excited
    const excitedButtons = page.getByRole('button').filter({ hasText: 'Excited' })
    await excitedButtons.first().click()

    // Select mood after: Neutral
    const neutralButtons = page.getByRole('button').filter({ hasText: 'Neutral' })
    await neutralButtons.last().click()

    // Select discipline score: Good (4)
    const goodButton = page.getByRole('button').filter({ hasText: /^4 — Good$/ })
    await goodButton.click()

    // Select followed plan: Yes
    const yesButton = page.getByRole('button', { name: 'Yes' })
    await yesButton.click()

    // Click Save
    const saveButton = page.getByRole('button', { name: /Save Reflection/ })
    await saveButton.click()

    // Verify the PATCH request was successful by checking the mock state
    await expect.poll(
      () => {
        const entry = state.entries.find((e) => e.id === 'entry-psychology-5')
        return entry?.mood_before === 'excited' &&
          entry?.mood_after === 'neutral' &&
          entry?.discipline_score === 4 &&
          entry?.followed_plan === true
      },
      { timeout: 10_000 },
    ).toBe(true)
  })

  test('dismisses prompt without saving', async ({ page }) => {
    const closedTrade = createMockEntry({
      id: 'entry-psychology-6',
      symbol: 'NVDA',
      is_open: false,
      entry_price: 900.00,
      exit_price: 910.00,
      pnl: 10.00,
      mood_before: null,
      mood_after: null,
      discipline_score: null,
      followed_plan: null,
    })

    const state = await setupJournalCrudMocks(page, [closedTrade])
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    // Expand the prompt
    const promptCard = page.locator('button').filter({ hasText: /How did you feel during/ })
    await promptCard.click()

    // Select some values but don't save
    const confidentButtons = page.getByRole('button').filter({ hasText: 'Confident' })
    await confidentButtons.first().click()

    // Click Skip button to dismiss
    const skipButton = page.getByRole('button', { name: 'Skip' })
    await skipButton.click()

    // Verify the prompt card is collapsed back to the initial state
    await expect(page.locator('button').filter({ hasText: /How did you feel during/ })).toBeVisible()

    // Verify the entry mood fields remain null (not persisted)
    const entry = state.entries.find((e) => e.id === 'entry-psychology-6')
    expect(entry?.mood_before).toBeNull()
    expect(entry?.mood_after).toBeNull()
    expect(entry?.discipline_score).toBeNull()
    expect(entry?.followed_plan).toBeNull()
  })
})
