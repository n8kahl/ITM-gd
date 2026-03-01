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
    await expect(page.getByRole('heading', { name: /6030C 2026-03-20|6020P 2026-03-20/i })).toBeVisible()

    await breakoutSetupButton.click()

    await expect(breakoutSetupCard).toHaveClass(/ring-1/)
    await expect(page.getByText(spxMockContracts.secondaryDescription)).toBeVisible()
  })

  test('allows switching back to AI recommendation after choosing an alternative contract', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const breakoutSetupButton = page.getByRole('button', { name: /bearish breakout.*triggered/i })
    await breakoutSetupButton.click()

    const contractPanel = page.getByRole('heading', { name: 'Contract Selector' }).locator('xpath=ancestor::section[1]')
    await expect(contractPanel.getByText(spxMockContracts.secondaryDescription)).toBeVisible()

    await contractPanel.getByRole('button', { name: /full analytics/i }).click()
    await contractPanel.getByRole('button', { name: /6015P 2026-03-20/i }).click()

    const useAiRecommendationButton = contractPanel.getByRole('button', { name: /use ai recommendation/i })
    await expect(useAiRecommendationButton).toBeVisible()
    await useAiRecommendationButton.click()
    await expect(useAiRecommendationButton).toHaveCount(0)
  })

  test('trade focus locks setup selection until trade is exited', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const fadeSetupButton = page.getByRole('button', { name: /bullish ranging.*actionable/i })
    const breakoutSetupButton = page.getByRole('button', { name: /bearish breakout.*triggered/i })
    const breakoutSetupCard = breakoutSetupButton.locator('..')
    const primaryCta = page.getByTestId('spx-action-primary-cta-desktop')

    await breakoutSetupButton.click()
    const initialPrimaryLabel = (await primaryCta.textContent())?.trim() || ''
    if (initialPrimaryLabel === 'Select Best Setup') {
      await primaryCta.click()
    }

    await expect(primaryCta).toContainText(/stage trade/i)
    await expect(primaryCta).toBeEnabled()
    await primaryCta.click()

    const focusBanner = page.getByText(/in trade ·/i)
    await expect(focusBanner).toBeVisible()
    await expect(focusBanner).toContainText(/bearish breakout/i)

    await expect(fadeSetupButton).toHaveCount(0)
    await expect(breakoutSetupCard).toHaveClass(/ring-1/)
    await expect(focusBanner).toContainText(/bearish breakout/i)

    await page.getByRole('button', { name: /exit trade/i }).first().click()
    await expect(page.getByText(/in trade ·/i)).toHaveCount(0)
    await expect(fadeSetupButton).toBeVisible()
  })
})
