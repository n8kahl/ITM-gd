import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks, spxMockContracts } from './helpers/spx-mocks'

test.describe('SPX setup interaction', () => {
  test('selecting a setup updates selection state and contract recommendation', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const fadeSetupButton = page.getByRole('button', { name: /bullish ranging.*actionable/i })
    const breakoutSetupButton = page.getByRole('button', { name: /bearish breakout.*triggered/i })
    const fadeSetupCard = fadeSetupButton.locator('..')
    const breakoutSetupCard = breakoutSetupButton.locator('..')

    await expect(fadeSetupButton).toBeVisible()
    await expect(breakoutSetupButton).toBeVisible()

    await fadeSetupButton.click()
    await expect(fadeSetupCard).toHaveClass(/ring-1/)
    await expect(page.getByText(spxMockContracts.primaryDescription)).toBeVisible()

    await breakoutSetupButton.click()

    await expect(breakoutSetupCard).toHaveClass(/ring-1/)
    await expect(page.getByText(spxMockContracts.secondaryDescription)).toBeVisible()
  })

  test('trade focus locks setup selection until focus is exited', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const fadeSetupButton = page.getByRole('button', { name: /bullish ranging.*actionable/i })
    const breakoutSetupButton = page.getByRole('button', { name: /bearish breakout.*triggered/i })
    const breakoutSetupCard = breakoutSetupButton.locator('..')
    const enterTradeFocusButton = page.getByRole('button', { name: /enter trade focus for bearish breakout vacuum/i })

    await expect(enterTradeFocusButton).toBeEnabled()
    await enterTradeFocusButton.click()

    const focusBanner = page.getByText(/in trade focus ·/i)
    await expect(focusBanner).toBeVisible()
    await expect(focusBanner).toContainText(/bearish breakout/i)

    await expect(fadeSetupButton).toHaveCount(0)
    await expect(breakoutSetupCard).toHaveClass(/ring-1/)
    await expect(focusBanner).toContainText(/bearish breakout/i)

    await page.getByRole('button', { name: /exit focus/i }).click()
    await expect(page.getByText(/in trade focus/i)).toHaveCount(0)
    await expect(fadeSetupButton).toBeVisible()
  })
})
