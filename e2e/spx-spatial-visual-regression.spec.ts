import { expect, test, type Page } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

const STABILIZE_CSS = `
*,
*::before,
*::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition: none !important;
  caret-color: transparent !important;
}
`

async function stabilizePage(page: Page): Promise<void> {
  await page.addStyleTag({ content: STABILIZE_CSS })
  await page.evaluate(async () => {
    if ('fonts' in document) {
      await document.fonts.ready
    }
  })
  await page.waitForTimeout(400)
}

test.describe('SPX spatial visual regression', () => {
  test('desktop evaluate mode baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1728, height: 1117 })
    await setupSPXCommandCenterMocks(page, { alignCoachMessagesToChart: true })
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        spatialHudV1: true,
        layoutStateMachine: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('spx-view-mode-spatial').click()
    await page.keyboard.press('j')

    await expect(page.getByTestId('spx-desktop-spatial')).toBeVisible()
    await expect(page.getByTestId('spx-sidebar-panel')).toBeVisible()

    const coneCount = await page.getByTestId('spx-probability-cone-svg').count()
    if (coneCount > 0) {
      await page.keyboard.press('c')
    }
    await expect(page.getByTestId('spx-probability-cone-svg')).toHaveCount(0)

    await stabilizePage(page)

    await expect(page).toHaveScreenshot('spx-spatial-hud-evaluate-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.06,
    })
  })

  test('fallback cone state baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await setupSPXCommandCenterMocks(page, { omitPrediction: true, snapshotDegraded: true })
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        spatialHudV1: true,
        layoutStateMachine: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('spx-view-mode-spatial').click()

    const cone = page.getByTestId('spx-probability-cone-svg')
    await expect(cone).toBeVisible()
    await expect(cone).toHaveAttribute('data-fallback', 'true')
    await expect(page.getByTestId('spx-probability-cone-fallback-badge')).toBeVisible()

    await stabilizePage(page)

    await expect(page).toHaveScreenshot('spx-spatial-hud-fallback-desktop.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.06,
    })
  })
})
