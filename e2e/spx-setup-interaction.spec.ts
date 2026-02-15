import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks, spxMockContracts } from './helpers/spx-mocks'

test.describe('SPX setup interaction', () => {
  test('selecting a setup updates selection state and contract recommendation', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const fadeSetupButton = page.getByRole('button', { name: /fade at wall/i })
    const breakoutSetupButton = page.getByRole('button', { name: /breakout vacuum/i })

    await expect(fadeSetupButton).toBeVisible()
    await expect(breakoutSetupButton).toBeVisible()

    await expect(page.getByText(spxMockContracts.primaryDescription)).toBeVisible()

    await breakoutSetupButton.click()

    await expect(breakoutSetupButton).toHaveClass(/ring-1/)
    await expect(page.getByText(spxMockContracts.secondaryDescription)).toBeVisible()
  })
})
