import { expect, test, type Page } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

async function assertNoHorizontalViewportOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement
    const body = document.body
    return {
      viewportWidth: window.innerWidth,
      clientWidth: root.clientWidth,
      docScrollWidth: root.scrollWidth,
      bodyScrollWidth: body ? body.scrollWidth : 0,
    }
  })

  expect(metrics.docScrollWidth, `document overflow metrics=${JSON.stringify(metrics)}`)
    .toBeLessThanOrEqual(metrics.clientWidth + 1)
  expect(metrics.bodyScrollWidth, `body overflow metrics=${JSON.stringify(metrics)}`)
    .toBeLessThanOrEqual(metrics.clientWidth + 1)
}

test.describe('SPX responsive core layout', () => {
  test('keeps desktop core controls usable at 1280px without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('spx-action-strip')).toBeVisible()
    await expect(page.getByTestId('spx-action-core-controls')).toBeVisible()
    await expect(page.locator('[data-testid="spx-action-core-controls"] [data-testid^="spx-action-core-"]:visible')).toHaveCount(6)
    await expect(page.getByTestId('spx-action-core-primary-cta')).toBeVisible()
    await expect(page.getByTestId('spx-action-core-view-mode')).toBeVisible()

    await assertNoHorizontalViewportOverflow(page)

    const advancedToggle = page.getByTestId('spx-action-advanced-hud-toggle')
    await expect(advancedToggle).toBeVisible()
    await advancedToggle.click()
    await expect(page.getByTestId('spx-action-advanced-hud-drawer')).toHaveAttribute('data-state', 'open')

    await assertNoHorizontalViewportOverflow(page)
  })

  test('keeps mobile primary workflow reachable at 375px without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('spx-mobile-primary-cta')).toBeVisible()
    await expect(page.getByTestId('spx-mobile-primary-cta-button')).toBeVisible()
    await expect(page.getByTestId('spx-mobile-settings-trigger')).toBeVisible()
    await expect(page.getByTestId('spx-mobile-primary-action-mode-chip')).toBeVisible()

    await assertNoHorizontalViewportOverflow(page)

    await page.getByTestId('spx-mobile-settings-trigger').click()
    await expect(page.getByTestId('spx-settings-sheet')).toBeVisible()

    await assertNoHorizontalViewportOverflow(page)
  })
})
