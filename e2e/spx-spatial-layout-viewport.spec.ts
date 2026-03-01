import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1728, height: 1117 },
]

test.describe('SPX spatial layout viewport guardrails', () => {
  for (const viewport of VIEWPORTS) {
    test(`keeps chart-forward balance at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await setupSPXCommandCenterMocks(page)
      await authenticateAsMember(page)
      await page.addInitScript(() => {
        window.__spxUxFlags = {
          spatialHudV1: true,
          layoutStateMachine: true,
        }
      })

      await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
      const spatialToggle = page.getByTestId('spx-view-mode-spatial')
      await expect(spatialToggle).toBeVisible()
      await expect(spatialToggle).toBeEnabled()
      if ((await spatialToggle.getAttribute('aria-pressed')) !== 'true') {
        await spatialToggle.click({ force: true })
      }
      await expect(spatialToggle).toHaveAttribute('aria-pressed', 'true')

      const chart = page.getByTestId('spx-desktop-spatial')
      const sidebar = page.getByTestId('spx-sidebar-panel')
      const actionStrip = page.getByTestId('spx-action-strip')
      await expect(chart).toBeVisible()
      await expect(sidebar).toBeVisible()
      await expect(actionStrip).toBeVisible()
      await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBeGreaterThan(120)

      const chartBox = await chart.boundingBox()
      const sidebarBox = await sidebar.boundingBox()
      expect(chartBox).not.toBeNull()
      expect(sidebarBox).not.toBeNull()
      if (!chartBox || !sidebarBox) return

      expect(chartBox.width).toBeGreaterThan(viewport.width * 0.42)
      expect(chartBox.width).toBeGreaterThan(sidebarBox.width * 1.5)
      expect(sidebarBox.width).toBeLessThanOrEqual(420)

      await expect(page.getByTestId('spx-sidebar-decision-zone')).toBeVisible()
      await expect(page.getByTestId('spx-sidebar-analytics-drawer')).toBeVisible()
    })
  }
})
