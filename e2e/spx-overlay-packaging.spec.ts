import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX overlay packaging', () => {
  test('keeps presets deterministic and advanced controls in HUD drawer', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        spatialHudV1: true,
        layoutStateMachine: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('spx-action-preset-execution')).toBeVisible()
    await expect(page.getByTestId('spx-action-preset-flow')).toBeVisible()
    await expect(page.getByTestId('spx-action-preset-spatial')).toBeVisible()
    await expect(page.getByTestId('spx-action-strip-throttle-indicator')).toHaveCount(0)

    const advancedHudToggle = page.getByTestId('spx-action-advanced-hud-toggle')
    const advancedHudDrawer = page.getByTestId('spx-action-advanced-hud-drawer')
    await expect(advancedHudDrawer).toHaveAttribute('data-state', 'closed')
    await advancedHudToggle.click()
    await expect(advancedHudDrawer).toHaveAttribute('data-state', 'open')

    const levels = page.getByTestId('spx-action-overlay-levels')
    const cone = page.getByTestId('spx-action-overlay-cone')
    const coach = page.getByTestId('spx-action-overlay-coach')
    const gex = page.getByTestId('spx-action-overlay-gex')
    const clickPreset = async (preset: 'execution' | 'flow' | 'spatial') => {
      await page.getByTestId(`spx-action-preset-${preset}`).evaluate((node) => {
        (node as HTMLButtonElement).click()
      })
    }

    await page.getByTestId('spx-view-mode-spatial').click()
    await expect(cone).toBeEnabled()
    await expect(coach).toBeEnabled()
    await expect(gex).toBeEnabled()

    await clickPreset('execution')
    await expect(levels).toHaveAttribute('aria-pressed', 'true')
    await expect(cone).toHaveAttribute('aria-pressed', 'false')
    await expect(coach).toHaveAttribute('aria-pressed', 'false')
    await expect(gex).toHaveAttribute('aria-pressed', 'false')

    await clickPreset('flow')
    await expect(levels).toHaveAttribute('aria-pressed', 'true')
    await expect(cone).toHaveAttribute('aria-pressed', 'false')
    await expect(coach).toHaveAttribute('aria-pressed', 'false')
    await expect(gex).toHaveAttribute('aria-pressed', 'true')

    await clickPreset('spatial')
    await expect(levels).toHaveAttribute('aria-pressed', 'true')
    await expect(cone).toHaveAttribute('aria-pressed', 'true')
    await expect(coach).toHaveAttribute('aria-pressed', 'true')
    await expect(gex).toHaveAttribute('aria-pressed', 'true')
  })
})
