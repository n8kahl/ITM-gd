import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX view mode toggle', () => {
  test('switches between classic and spatial desktop views and persists selection', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        layoutStateMachine: true,
        spatialHudV1: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('spx-desktop-state-driven')).toBeVisible()

    await expect(page.getByTestId('spx-view-mode-toggle')).toBeVisible()
    await expect(page.getByTestId('spx-view-mode-classic')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('spx-desktop-state-driven')).toBeVisible()

    await page.getByTestId('spx-view-mode-spatial').click()
    await expect(page.getByTestId('spx-view-mode-spatial')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('spx-desktop-spatial')).toBeVisible()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('spx-desktop-spatial')).toBeVisible()
    await expect(page.getByTestId('spx-view-mode-spatial')).toHaveAttribute('aria-pressed', 'true')

    await page.getByTestId('spx-view-mode-classic').click()
    await expect(page.getByTestId('spx-view-mode-classic')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('spx-desktop-state-driven')).toBeVisible()
  })
})
