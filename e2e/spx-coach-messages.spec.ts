import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { coachLongMessage, setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX coach messages', () => {
  test('streams coach output with priority styling and expandable content', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const input = page.getByPlaceholder('Ask coach for setup guidance')
    await expect(input).toBeVisible()

    await input.fill('How should I manage this setup?')
    await page.getByRole('button', { name: 'Send coach message' }).click()

    const firstSentence = coachLongMessage.split('.')[0]
    await expect(page.getByText(firstSentence, { exact: false })).toBeVisible()

    const alertTag = page.getByText('alert').first()
    await expect(alertTag).toBeVisible()

    const expandButton = page.getByRole('button', { name: 'Expand' }).first()
    await expect(expandButton).toBeVisible()

    await expandButton.click()
    await expect(page.getByRole('button', { name: 'Collapse' }).first()).toBeVisible()
    await expect(page.getByText('If flow diverges for more than two prints', { exact: false })).toBeVisible()
  })
})
