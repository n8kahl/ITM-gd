import { expect, test, type Page } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

async function pressShortcut(page: Page, key: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  })
  await page.keyboard.press(key)
}

async function ensureSpatialMode(page: Page) {
  const spatialSurface = page.getByTestId('spx-desktop-spatial')
  const spatialToggle = page.getByTestId('spx-view-mode-spatial')
  for (let attempt = 0; attempt < 48; attempt += 1) {
    if (await spatialSurface.isVisible().catch(() => false)) return
    if (await spatialToggle.isVisible().catch(() => false)) {
      if (await spatialToggle.isEnabled().catch(() => false)) {
        if ((await spatialToggle.getAttribute('aria-pressed')) !== 'true') {
          await spatialToggle.click({ force: true })
        }
      }
      await expect(spatialSurface).toBeVisible({ timeout: 12_000 })
      return
    }
    await page.waitForTimeout(250)
  }

  await expect(spatialSurface).toBeVisible({ timeout: 12_000 })
}

test.describe('SPX spatial overlays', () => {
  test('renders cone overlay and supports overlay shortcuts in spatial mode', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.localStorage.setItem('spx.command_center:view_mode', 'spatial')
      window.__spxUxFlags = {
        spatialHudV1: true,
        layoutStateMachine: true,
        spatialCoachGhostCards: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await ensureSpatialMode(page)

    await expect(page.getByTestId('spx-sidebar-panel')).toBeVisible()
    const cone = page.getByTestId('spx-probability-cone-svg')
    await expect(cone).toBeVisible({ timeout: 12_000 })
    const coneAnchorMode = await cone.getAttribute('data-anchor-mode')
    if (coneAnchorMode === 'time') {
      await expect(page.getByTestId('spx-probability-cone-start')).toBeVisible()
    } else {
      await expect(page.getByTestId('spx-probability-cone-start')).toHaveCount(0)
      await expect(page.getByTestId('spx-probability-cone-fallback-badge')).toBeVisible()
    }
    await expect(page.getByTestId('spx-probability-cone-path')).toHaveAttribute('d', /M.*Z/)
    await expect(page.getByTestId('spx-spatial-marker-legend')).toBeVisible()
    await expect(page.getByTestId('spx-priority-level-overlay')).toBeVisible()
    await expect(page.getByTestId('spx-header-levels-chip')).toContainText(/[1-9]\d*\/\d+/)
    await expect(page.getByTestId('spx-topographic-ladder')).toHaveCount(0)
    await expect(page.getByTestId('spx-gamma-topography')).toBeVisible()
    await expect(page.getByTestId('spx-flow-ribbon')).toBeVisible()
    await expect(page.getByTestId('spx-gamma-rail')).toBeVisible()
    await expect(page.getByTestId('spx-gamma-vacuum-zone').first()).toBeVisible()

    await pressShortcut(page, 'm')
    await expect(page.getByTestId('spx-priority-level-overlay')).toHaveCount(0)
    await expect(page.getByTestId('spx-topographic-ladder')).toHaveCount(0)
    await expect(page.getByTestId('spx-setup-lock-overlay')).toHaveCount(0)
    await expect(page.getByTestId('spx-rr-shadow-overlay')).toHaveCount(0)

    await pressShortcut(page, 'm')
    await expect(page.getByTestId('spx-priority-level-overlay')).toBeVisible()

    await pressShortcut(page, 'j')
    await expect(page.getByTestId('spx-setup-lock-overlay')).toHaveCount(0)
    await expect(page.getByTestId('spx-rr-shadow-overlay')).toHaveCount(0)

    await pressShortcut(page, 'a')
    await expect(page.getByTestId('spx-spatial-ghost-layer')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByTestId('spx-coach-ghost-card').first()).toBeVisible()
    await expect(page.getByTestId('spx-coach-ghost-card').first()).toHaveAttribute('data-lifecycle-state', /entering|active|fading/)
    await expect(page.getByTestId('spx-coach-ghost-card').first()).toHaveAttribute('data-anchor-mode', /time|fallback/)
    await expect(page.getByTestId('spx-spatial-coach-node').first()).toBeVisible()
    await expect(page.getByTestId('spx-spatial-coach-node').first()).toHaveAttribute('data-anchor-mode', /time|fallback/)

    await pressShortcut(page, 'a')
    await expect(page.getByTestId('spx-spatial-ghost-layer')).toHaveCount(0)

    await pressShortcut(page, 'c')
    await expect(page.getByTestId('spx-probability-cone-svg')).toHaveCount(0)

    await pressShortcut(page, 'c')
    await expect(page.getByTestId('spx-probability-cone-svg')).toBeVisible({ timeout: 12_000 })

    await pressShortcut(page, 'g')
    await expect(page.getByTestId('spx-gamma-topography')).toHaveCount(0)

    await pressShortcut(page, 'g')
    await expect(page.getByTestId('spx-gamma-topography')).toBeVisible()

    await pressShortcut(page, 's')
    await expect(page.getByTestId('spx-sidebar-panel')).toHaveCount(0)

    await pressShortcut(page, 'i')
    await expect(page.getByTestId('spx-sidebar-panel')).toHaveCount(0)
  })

  test('uses fallback cone rendering when prediction windows are unavailable', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { omitPrediction: true })
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.localStorage.setItem('spx.command_center:view_mode', 'spatial')
      window.__spxUxFlags = {
        spatialHudV1: true,
        layoutStateMachine: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await ensureSpatialMode(page)

    const cone = page.getByTestId('spx-probability-cone-svg')
    await expect(cone).toBeVisible({ timeout: 12_000 })
    await expect(cone).toHaveAttribute('data-fallback', 'true')
    await expect(cone).toHaveAttribute('data-anchor-mode', /time|fallback/)
    await expect(page.getByTestId('spx-probability-cone-fallback-badge')).toBeVisible()
    await expect(page.getByTestId('spx-probability-cone-path')).toHaveAttribute('d', /M.*Z/)
  })

  test('keeps ghost cards disabled by default while spatial coach nodes remain active', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { alignCoachMessagesToChart: true })
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.localStorage.setItem('spx.command_center:view_mode', 'spatial')
      window.__spxUxFlags = {
        spatialHudV1: true,
        layoutStateMachine: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await ensureSpatialMode(page)

    await pressShortcut(page, 'a')
    await expect(page.getByTestId('spx-spatial-ghost-layer')).toHaveCount(0)
    await expect(page.getByTestId('spx-spatial-coach-node').first()).toBeVisible({ timeout: 10_000 })
  })

  test('time-anchors ghost cards when coach timestamps align to chart window', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { alignCoachMessagesToChart: true })
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.localStorage.setItem('spx.command_center:view_mode', 'spatial')
      window.__spxUxFlags = {
        spatialHudV1: true,
        layoutStateMachine: true,
        spatialCoachGhostCards: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await ensureSpatialMode(page)

    await pressShortcut(page, 'a')
    await expect(page.getByTestId('spx-spatial-ghost-layer')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid=\"spx-coach-ghost-card\"][data-anchor-mode=\"time\"]').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid=\"spx-spatial-coach-node\"][data-anchor-mode=\"time\"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('surfaces degraded data health state in spatial header', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { snapshotDegraded: true })
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.localStorage.setItem('spx.command_center:view_mode', 'spatial')
      window.__spxUxFlags = {
        spatialHudV1: true,
        layoutStateMachine: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await ensureSpatialMode(page)

    const header = page.getByTestId('spx-header-overlay')
    await expect(header).toBeVisible()
    await expect(header).toContainText(/degraded/i)
  })
})
