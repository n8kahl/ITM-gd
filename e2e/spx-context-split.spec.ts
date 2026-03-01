import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { coachLongMessage, setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX context split', () => {
  test('renders and preserves core interactions when context split flag is enabled', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        contextSplitV1: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('spx-header-overlay')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Setup Feed' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'AI Coach' })).toBeVisible()

    const breakoutSetupButton = page.getByRole('button', { name: /bearish breakout.*triggered/i })
    await breakoutSetupButton.click()
    await expect(page.getByText('6020P 2026-03-20')).toBeVisible()

    await page.getByTestId('spx-flow-toggle').click()
    await expect(page.getByTestId('spx-flow-expanded')).toBeVisible()

    const coachFeed = page.getByTestId('spx-ai-coach-feed')
    const coachInput = coachFeed.getByRole('textbox')
    await expect(coachInput).toBeVisible()
    await coachInput.fill('Confirm this setup context')
    await coachFeed.getByRole('button', { name: 'Send coach message' }).click()
    await coachFeed.getByRole('button', { name: 'All' }).click()
    await expect(page.getByText(coachLongMessage.split('.')[0] || coachLongMessage, { exact: false })).toBeVisible()
  })
})
