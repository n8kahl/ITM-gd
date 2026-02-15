import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX responsive layout', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('mobile tabs switch panels and keep touch targets >= 44px', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const chartTab = page.getByRole('button', { name: 'Chart' })
    const setupsTab = page.getByRole('button', { name: 'Setups' })
    const coachTab = page.getByRole('button', { name: 'Coach' })
    const levelsTab = page.getByRole('button', { name: 'Levels' })

    for (const tab of [chartTab, setupsTab, coachTab, levelsTab]) {
      await expect(tab).toBeVisible()
      const box = await tab.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }

    await setupsTab.click()
    await expect(page.getByRole('heading', { name: 'Setup Feed' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Contract Selector' })).toBeVisible()

    await coachTab.click()
    await expect(page.getByRole('heading', { name: 'AI Coach' })).toBeVisible()
    await expect(page.getByText('SPX/SPY Basis')).toBeVisible()

    await levelsTab.click()
    await expect(page.getByRole('heading', { name: 'Level Matrix' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'GEX Landscape' })).toBeVisible()

    await chartTab.click()
    await expect(page.getByText('Conf 72%')).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement
      return root.scrollWidth > root.clientWidth
    })

    expect(hasHorizontalOverflow).toBe(false)
  })
})
