import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX responsive layout', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('mobile smart stack renders unified sections and keeps primary touch targets >= 44px', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        coachDockV1: true,
      }
    })
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const smartStack = page.getByTestId('spx-mobile-smart-stack')
    await expect(smartStack).toBeVisible()
    await expect(page.getByRole('button', { name: 'Brief' })).toHaveCount(0)

    await expect(page.getByRole('heading', { name: 'Setup Feed' })).toBeVisible()
    await expect(page.getByTestId('spx-coach-dock-mobile')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Price + Levels' })).toBeVisible()

    await page.getByTestId('spx-coach-dock-toggle-mobile').click()
    await expect(page.getByTestId('spx-coach-bottom-sheet')).toBeVisible()
    await expect(page.getByTestId('spx-coach-bottom-sheet').getByRole('heading', { level: 2, name: 'AI Coach' })).toBeVisible()
    await page.getByTestId('spx-coach-bottom-sheet-close').click()
    await expect(page.getByTestId('spx-coach-bottom-sheet')).toHaveCount(0)

    await page.getByText('Deep Analytics').click()
    await expect(page.getByRole('heading', { name: 'Level Matrix' })).toBeVisible()
    await expect(page.getByText('GEX Landscape')).toBeVisible()

    const primaryActionButton = page.getByTestId('spx-mobile-primary-cta-button')
    await expect(primaryActionButton).toBeVisible()
    const buttonBox = await primaryActionButton.boundingBox()
    expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44)
    await expect(page.getByRole('button', { name: /stage trade for bearish breakout vacuum/i })).toHaveCount(0)

    const hasHorizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement
      return root.scrollWidth > root.clientWidth
    })

    expect(hasHorizontalOverflow).toBe(false)
  })
})
