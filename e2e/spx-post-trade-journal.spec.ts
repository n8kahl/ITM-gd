import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX post-trade journal capture', () => {
  test('captures a journal artifact on trade focus exit', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.localStorage.removeItem('spx.command_center.trade_journal.v1')
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const primaryCta = page.getByTestId('spx-action-primary-cta-desktop')
    const initialLabel = (await primaryCta.textContent())?.trim() || ''
    if (initialLabel === 'Select Best Setup') {
      await primaryCta.click()
    }

    await expect(primaryCta).toContainText('Stage Trade')
    await primaryCta.click()
    await expect(primaryCta).toContainText('Manage Risk / Exit Trade')
    await primaryCta.click()

    const postTradePanel = page.getByTestId('spx-post-trade-panel').first()
    await expect(postTradePanel).toBeVisible()
    await expect(postTradePanel).not.toContainText('Trade exits will auto-capture here.')
  })
})
