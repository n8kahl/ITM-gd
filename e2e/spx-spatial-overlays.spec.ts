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
    await expect(page.getByTestId('spx-probability-cone-start')).toBeVisible()
    await expect(page.getByTestId('spx-probability-cone-path')).toHaveAttribute('d', /M.*Z/)
    await expect(page.getByTestId('spx-topographic-ladder')).toBeVisible()
    await expect(page.getByTestId('spx-gamma-topography')).toBeVisible()
    await expect(page.getByTestId('spx-flow-ribbon')).toBeVisible()
    await expect(page.getByTestId('spx-gamma-rail')).toBeVisible()
    await expect(page.getByTestId('spx-gamma-vacuum-zone').first()).toBeVisible()

    await page.keyboard.press('j')
    await expect(page.getByTestId('spx-setup-lock-overlay')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByTestId('spx-rr-shadow-overlay')).toBeVisible({ timeout: 8_000 })

    await page.keyboard.press('a')
    await expect(page.getByTestId('spx-spatial-ghost-layer')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByTestId('spx-coach-ghost-card').first()).toBeVisible()
    await expect(page.getByTestId('spx-coach-ghost-card').first()).toHaveAttribute('data-lifecycle-state', /entering|active|fading/)
    await expect(page.getByTestId('spx-coach-ghost-card').first()).toHaveAttribute('data-anchor-mode', /time|fallback/)
    await expect(page.getByTestId('spx-spatial-coach-node').first()).toBeVisible()
    await expect(page.getByTestId('spx-spatial-coach-node').first()).toHaveAttribute('data-anchor-mode', /time|fallback/)

    await page.keyboard.press('a')
    await expect(page.getByTestId('spx-spatial-ghost-layer')).toHaveCount(0)

    await page.keyboard.press('c')
    await expect(page.getByTestId('spx-probability-cone-svg')).toHaveCount(0)

    await page.keyboard.press('c')
    await expect(page.getByTestId('spx-probability-cone-svg')).toBeVisible({ timeout: 12_000 })

    await page.keyboard.press('g')
    await expect(page.getByTestId('spx-gamma-topography')).toHaveCount(0)

    await page.keyboard.press('g')
    await expect(page.getByTestId('spx-gamma-topography')).toBeVisible()

    await page.keyboard.press('s')
    await expect(page.getByTestId('spx-sidebar-panel')).toHaveCount(0)

    await page.keyboard.press('i')
    await expect(page.getByTestId('spx-sidebar-panel')).toHaveCount(0)
  })

  test('uses fallback cone rendering when prediction windows are unavailable', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { omitPrediction: true })
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
    await expect(cone).toBeVisible({ timeout: 12_000 })
    await expect(cone).toHaveAttribute('data-fallback', 'true')
    await expect(cone).toHaveAttribute('data-anchor-mode', /time|fallback/)
    await expect(page.getByTestId('spx-probability-cone-fallback-badge')).toBeVisible()
    await expect(page.getByTestId('spx-probability-cone-path')).toHaveAttribute('d', /M.*Z/)
  })

  test('time-anchors ghost cards when coach timestamps align to chart window', async ({ page }) => {
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

    await page.keyboard.press('a')
    await expect(page.getByTestId('spx-spatial-ghost-layer')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid=\"spx-coach-ghost-card\"][data-anchor-mode=\"time\"]').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid=\"spx-spatial-coach-node\"][data-anchor-mode=\"time\"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('surfaces degraded data health state in spatial header', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { snapshotDegraded: true })
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        spatialHudV1: true,
        layoutStateMachine: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('spx-view-mode-spatial').click()

    const header = page.getByTestId('spx-header-overlay')
    await expect(header).toBeVisible()
    await expect(header).toContainText(/degraded/i)
  })
})
