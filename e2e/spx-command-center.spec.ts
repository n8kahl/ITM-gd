import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX Command Center', () => {
  test('renders command center surfaces and toggles flow compact mode', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { delayMs: 150 })
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'networkidle' })
    await expect(page.getByText('SPX Command Center').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Setup Feed' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'AI Coach' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Contract Selector' })).toBeVisible()
    await expect(page.getByTestId('spx-flow-ticker')).toBeVisible()

    await expect(page.getByTestId('spx-flow-expanded')).toHaveCount(0)
    await page.getByTestId('spx-flow-toggle').click()
    await expect(page.getByTestId('spx-flow-expanded')).toBeVisible()
    await page.getByTestId('spx-flow-toggle').click()
    await expect(page.getByTestId('spx-flow-expanded')).toHaveCount(0)
  })

  test('shares coach alert acknowledgement between action strip and coach panel across reload', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { delayMs: 100 })
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'networkidle' })

    await page.getByTestId('spx-ai-coach-feed').getByRole('button', { name: 'All' }).click()
    await expect(page.getByTestId('spx-ai-coach-pinned-alert')).toBeVisible()
    await expect(page.getByTestId('spx-action-strip-alert')).toBeVisible()

    await page.getByTestId('spx-action-strip-alert-ack').click()
    const dismissedBeforeReload = await page.evaluate(() => {
      const raw = window.sessionStorage.getItem('spx.coach.dismissed_alert_ids.v1')
      if (!raw) return []
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []
      } catch {
        return []
      }
    })
    expect(dismissedBeforeReload.length).toBeGreaterThan(0)

    await page.reload({ waitUntil: 'networkidle' })
    await page.getByTestId('spx-ai-coach-feed').getByRole('button', { name: 'All' }).click()
    const dismissedAfterReload = await page.evaluate(() => {
      const raw = window.sessionStorage.getItem('spx.coach.dismissed_alert_ids.v1')
      if (!raw) return []
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []
      } catch {
        return []
      }
    })
    for (const id of dismissedBeforeReload) {
      expect(dismissedAfterReload).toContain(id)
    }
  })
})
