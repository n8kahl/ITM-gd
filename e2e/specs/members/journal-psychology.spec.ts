import { expect, test, type Page } from '@playwright/test'
import {
  enableMemberBypass,
  setupJournalCrudMocks,
  setupMemberShellMocks,
} from './journal-test-helpers'

const JOURNAL_URL = '/members/journal?e2eBypassAuth=1'

async function createClosedTradeAndOpenPrompt(page: Page, symbol: string) {
  await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: 'New Entry' }).click()
  await page.locator('input[placeholder="AAPL"]').fill(symbol)
  await page.locator('input[placeholder="0.00"]').first().fill('100')
  await page.locator('input[placeholder="0.00"]').nth(1).fill('102')

  const saveButton = page.getByRole('button', { name: 'Save' }).first()
  await saveButton.evaluate((button: HTMLButtonElement) => button.click())

  const promptCard = page
    .locator('button')
    .filter({ hasText: new RegExp(`How did you feel during\\s*${symbol}`, 'i') })
  await expect(promptCard).toBeVisible({ timeout: 10_000 })
  return promptCard
}

test.describe('Psychology Prompt', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('shows psychology prompt card for recently closed trade', async ({ page }) => {
    await setupJournalCrudMocks(page, [])
    const promptCard = await createClosedTradeAndOpenPrompt(page, 'SPY')

    const brainIcon = promptCard.locator('svg').first()
    await expect(brainIcon).toBeVisible()
    await expect(promptCard).toContainText('SPY')
  })

  test('expands prompt to show mood selection', async ({ page }) => {
    await setupJournalCrudMocks(page, [])
    const promptCard = await createClosedTradeAndOpenPrompt(page, 'AAPL')
    await promptCard.click()

    await expect(page.getByText('Post-Trade Reflection')).toBeVisible()

    const moodLabels = ['Confident', 'Neutral', 'Anxious', 'Frustrated', 'Excited', 'Fearful']
    for (const mood of moodLabels) {
      const button = page.getByRole('button').filter({ hasText: mood }).first()
      await expect(button).toBeVisible()
    }

    const disciplineLabels = ['Poor', 'Below Avg', 'Average', 'Good', 'Excellent']
    for (const label of disciplineLabels) {
      const button = page.getByRole('button').filter({ hasText: label }).first()
      await expect(button).toBeVisible()
    }

    await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'No' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Save Reflection/ })).toBeVisible()
  })

  test('selects mood before and mood after', async ({ page }) => {
    await setupJournalCrudMocks(page, [])
    const promptCard = await createClosedTradeAndOpenPrompt(page, 'TSLA')
    await promptCard.click()

    const confidentButtons = page.getByRole('button').filter({ hasText: 'Confident' })
    const confidentBefore = confidentButtons.first()
    await confidentBefore.click()
    await expect(confidentBefore).toHaveClass(/bg-amber-500/)

    const neutralButtons = page.getByRole('button').filter({ hasText: 'Neutral' })
    const neutralAfter = neutralButtons.last()
    await neutralAfter.click()
    await expect(neutralAfter).toHaveClass(/bg-amber-500/)
  })

  test('selects discipline score', async ({ page }) => {
    await setupJournalCrudMocks(page, [])
    const promptCard = await createClosedTradeAndOpenPrompt(page, 'QQQ')
    await promptCard.click()

    const goodButton = page.getByRole('button').filter({ hasText: /^4 — Good$/ })
    await goodButton.click()
    await expect(goodButton).toHaveClass(/bg-amber-500/)
  })

  test('saves psychology data via PATCH', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])
    const promptCard = await createClosedTradeAndOpenPrompt(page, 'MSFT')
    await promptCard.click()

    const excitedButtons = page.getByRole('button').filter({ hasText: 'Excited' })
    await excitedButtons.first().click()

    const neutralButtons = page.getByRole('button').filter({ hasText: 'Neutral' })
    await neutralButtons.last().click()

    const goodButton = page.getByRole('button').filter({ hasText: /^4 — Good$/ })
    await goodButton.click()

    const yesButton = page.getByRole('button', { name: 'Yes' })
    await yesButton.click()

    const saveButton = page.getByRole('button', { name: /Save Reflection/ })
    await saveButton.click()

    await expect.poll(
      () => {
        const entry = state.entries.find((e) => e.symbol === 'MSFT')
        return entry
          ? {
              mood_before: entry.mood_before,
              mood_after: entry.mood_after,
              discipline_score: entry.discipline_score,
              followed_plan: entry.followed_plan,
            }
          : null
      },
      { timeout: 10_000 },
    ).toEqual({
      mood_before: 'excited',
      mood_after: 'neutral',
      discipline_score: 4,
      followed_plan: true,
    })
  })

  test('dismisses prompt without saving', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])
    const promptCard = await createClosedTradeAndOpenPrompt(page, 'NVDA')
    await promptCard.click()

    const confidentButtons = page.getByRole('button').filter({ hasText: 'Confident' })
    await confidentButtons.first().click()

    const skipButton = page.getByRole('button', { name: 'Skip' })
    await skipButton.click()

    await expect(
      page.locator('button').filter({ hasText: /How did you feel during\s*NVDA/i }),
    ).toHaveCount(0)

    const entry = state.entries.find((e) => e.symbol === 'NVDA')
    expect(entry?.mood_before).toBeNull()
    expect(entry?.mood_after).toBeNull()
    expect(entry?.discipline_score).toBeNull()
    expect(entry?.followed_plan).toBeNull()
  })
})
