import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

const CORE_CONTROL_TEST_IDS = [
  'spx-action-core-timeframe',
  'spx-action-core-levels',
  'spx-action-core-primary-cta',
  'spx-action-core-why',
  'spx-action-core-state-chip',
  'spx-action-core-view-mode',
] as const

test.describe('SPX action strip core controls', () => {
  test('exposes only core-six controls in default desktop action strip', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        layoutStateMachine: true,
        spatialHudV1: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const coreControls = page.getByTestId('spx-action-core-controls')
    const advancedHudToggle = page.getByTestId('spx-action-advanced-hud-toggle')
    const advancedHudDrawer = page.getByTestId('spx-action-advanced-hud-drawer')
    await expect(coreControls).toBeVisible()
    await expect(advancedHudToggle).toBeVisible()
    await expect(advancedHudDrawer).toHaveAttribute('data-state', 'closed')

    for (const testId of CORE_CONTROL_TEST_IDS) {
      await expect(coreControls.getByTestId(testId)).toBeVisible()
    }

    const visibleCoreCount = await coreControls
      .locator('[data-testid^="spx-action-core-"]')
      .evaluateAll((elements) => {
        return elements.filter((element) => {
          const node = element as HTMLElement
          const style = window.getComputedStyle(node)
          const rect = node.getBoundingClientRect()
          return style.display !== 'none'
            && style.visibility !== 'hidden'
            && style.opacity !== '0'
            && rect.width > 0
            && rect.height > 0
        }).length
      })

    expect(visibleCoreCount).toBe(6)
    await expect(coreControls.getByTestId('spx-action-advanced-hud-toggle')).toHaveCount(0)
    await expect(coreControls.getByTestId('spx-action-overlay-cone')).toHaveCount(0)
    await expect(coreControls.getByTestId('spx-action-overlay-coach')).toHaveCount(0)
    await expect(coreControls.getByTestId('spx-action-overlay-gex')).toHaveCount(0)
    await expect(coreControls.getByTestId('spx-action-sidebar-toggle')).toHaveCount(0)
    await expect(coreControls.getByTestId('spx-action-immersive-toggle')).toHaveCount(0)

    await advancedHudToggle.click()
    await expect(advancedHudDrawer).toHaveAttribute('data-state', 'open')
    await advancedHudToggle.click()
    await expect(advancedHudDrawer).toHaveAttribute('data-state', 'closed')
  })
})
