import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX mobile coach CTA hierarchy', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('deduplicates coach decision actions and keeps quick prompts collapsed by default', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        coachDockV1: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    await page.getByTestId('spx-coach-dock-toggle-mobile').click()
    const coachSheet = page.getByTestId('spx-coach-bottom-sheet')
    await expect(coachSheet).toBeVisible()

    const decisionActions = coachSheet.getByTestId('spx-coach-decision-actions')
    await expect(decisionActions).toBeVisible()
    await expect(decisionActions.getByRole('button', { name: /open coach history/i })).toHaveCount(0)
    const actionCount = await decisionActions.getByRole('button').count()
    expect(actionCount).toBeLessThanOrEqual(2)

    const quickPrompts = coachSheet.getByTestId('spx-coach-quick-prompts')
    await expect(quickPrompts).toHaveAttribute('data-state', 'closed')
    await coachSheet.getByTestId('spx-coach-quick-prompts-toggle').click()
    await expect(quickPrompts).toHaveAttribute('data-state', 'open')
  })
})
