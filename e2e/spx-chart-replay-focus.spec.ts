import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX chart replay and focus controls', () => {
  test('supports focus mode switching, replay controls, and scenario lanes', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { delayMs: 100 })
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await page.getByTestId('spx-action-advanced-hud-toggle').click()

    const focusDecision = page.getByTestId('spx-action-focus-mode-decision')
    const focusExecution = page.getByTestId('spx-action-focus-mode-execution')
    const focusRisk = page.getByTestId('spx-action-focus-mode-risk_only')

    await expect(focusDecision).toHaveAttribute('aria-pressed', 'true')
    await focusExecution.click()
    await expect(focusExecution).toHaveAttribute('aria-pressed', 'true')
    await focusRisk.click()
    await expect(focusRisk).toHaveAttribute('aria-pressed', 'true')
    await focusExecution.click()
    await expect(focusExecution).toHaveAttribute('aria-pressed', 'true')

    const replayToggle = page.getByTestId('spx-action-replay-toggle')
    const replayPlayback = page.getByTestId('spx-action-replay-playback')
    await replayToggle.click()
    await expect(replayToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('spx-chart-replay-status')).toBeVisible()

    await replayPlayback.click()
    await expect(replayPlayback).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('spx-chart-scenario-lanes').first()).toBeVisible()
    await expect(page.getByTestId('spx-coach-scenario-lanes').first()).toBeVisible()
  })
})
