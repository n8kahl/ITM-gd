import { expect, test, type Page } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

async function clickAction(locator: ReturnType<Page['getByTestId']>) {
  await locator.click({ force: true, noWaitAfter: true })
}

async function ensureAdvancedHudOpen(page: Page) {
  const toggle = page.getByTestId('spx-action-advanced-hud-toggle')
  const drawer = page.getByTestId('spx-action-advanced-hud-drawer')
  await expect(toggle).toBeVisible()
  const state = await drawer.getAttribute('data-state')
  if (state !== 'open') {
    await clickAction(toggle)
    await expect(drawer).toHaveAttribute('data-state', 'open')
  }
}

test.describe('SPX chart replay and focus controls', () => {
  test('supports focus mode switching, replay controls, and scenario lanes', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { delayMs: 100 })
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await ensureAdvancedHudOpen(page)

    const focusDecision = page.getByTestId('spx-action-focus-mode-decision')
    const focusExecution = page.getByTestId('spx-action-focus-mode-execution')
    const focusRisk = page.getByTestId('spx-action-focus-mode-risk_only')

    await expect(focusDecision).toHaveAttribute('aria-pressed', 'true')
    await clickAction(focusExecution)
    await expect(focusExecution).toHaveAttribute('aria-pressed', 'true')
    await clickAction(focusRisk)
    await expect(focusRisk).toHaveAttribute('aria-pressed', 'true')
    await clickAction(focusExecution)
    await expect(focusExecution).toHaveAttribute('aria-pressed', 'true')

    const replayToggle = page.getByTestId('spx-action-replay-toggle')
    const replayPlayback = page.getByTestId('spx-action-replay-playback')
    await clickAction(replayToggle)
    await expect(replayToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('spx-chart-replay-status')).toBeVisible()

    await clickAction(replayPlayback)
    await expect(replayPlayback).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('spx-chart-scenario-lanes').first()).toBeVisible()
    await expect(page.getByTestId('spx-coach-scenario-lanes').first()).toBeVisible()
  })
})
