import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX spatial overlays', () => {
  test('renders cone overlay and supports overlay shortcuts in spatial mode', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        spatialHudV1: true,
        layoutStateMachine: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('spx-view-mode-spatial').click()
    await expect(page.getByTestId('spx-desktop-spatial')).toBeVisible()

    await expect(page.getByTestId('spx-sidebar-panel')).toBeVisible()
    await expect(page.getByTestId('spx-probability-cone-svg')).toBeVisible({ timeout: 12_000 })

    await page.keyboard.press('c')
    await expect(page.getByTestId('spx-probability-cone-svg')).toHaveCount(0)

    await page.keyboard.press('c')
    await expect(page.getByTestId('spx-probability-cone-svg')).toBeVisible({ timeout: 12_000 })

    await page.keyboard.press('s')
    await expect(page.getByTestId('spx-sidebar-panel')).toHaveCount(0)

    await page.keyboard.press('i')
    await expect(page.getByTestId('spx-sidebar-panel')).toHaveCount(0)
  })
})
