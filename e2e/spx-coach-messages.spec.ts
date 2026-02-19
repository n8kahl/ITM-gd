import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { coachLongMessage, setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX coach messages', () => {
  test('streams coach output with priority styling and expandable content', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const coachFeed = page.getByTestId('spx-ai-coach-feed')
    const input = coachFeed.getByRole('textbox')
    await expect(input).toBeVisible()

    await input.fill('How should I manage this setup?')
    await coachFeed.getByRole('button', { name: 'Send coach message' }).click()
    await coachFeed.getByRole('button', { name: 'All' }).click()

    const firstSentence = coachLongMessage.split('.')[0]
    await expect(page.getByText(firstSentence, { exact: false })).toBeVisible()
    const streamedCard = page.locator('article').filter({ hasText: firstSentence }).first()

    const alertTag = page.getByText('alert').first()
    await expect(alertTag).toBeVisible()

    const expandButton = streamedCard.getByRole('button', { name: 'Expand' })
    await expect(expandButton).toBeVisible()

    await expandButton.click()
    await expect(streamedCard.getByRole('button', { name: 'Collapse' })).toBeVisible()
    await expect(streamedCard.getByText('If flow diverges for more than two prints', { exact: false })).toBeVisible()
  })
})
