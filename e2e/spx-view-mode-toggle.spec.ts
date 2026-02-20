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
    await expect(page.getByTestId('spx-action-overlay-cone')).toBeDisabled()
    await expect(page.getByTestId('spx-action-overlay-coach')).toBeDisabled()
    await expect(page.getByTestId('spx-action-overlay-gex')).toBeDisabled()
    await expect(page.getByTestId('spx-action-sidebar-toggle')).toBeDisabled()
    await expect(page.getByTestId('spx-action-immersive-toggle')).toBeDisabled()

    await page.getByTestId('spx-view-mode-spatial').click()
    await expect(page.getByTestId('spx-view-mode-spatial')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('spx-desktop-spatial')).toBeVisible()
    await expect(page.getByTestId('spx-action-overlay-cone')).toBeEnabled()
    await expect(page.getByTestId('spx-action-overlay-coach')).toBeEnabled()
    await expect(page.getByTestId('spx-action-overlay-gex')).toBeEnabled()
    await expect(page.getByTestId('spx-action-sidebar-toggle')).toBeEnabled()
    await expect(page.getByTestId('spx-action-immersive-toggle')).toBeEnabled()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('spx-desktop-spatial')).toBeVisible()
    await expect(page.getByTestId('spx-view-mode-spatial')).toHaveAttribute('aria-pressed', 'true')

    await page.getByTestId('spx-view-mode-classic').click()
    await expect(page.getByTestId('spx-view-mode-classic')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('spx-desktop-state-driven')).toBeVisible()
  })
})
