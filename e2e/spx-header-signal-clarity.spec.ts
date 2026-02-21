import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX header signal clarity', () => {
  test('shows explicit regime, health, feed, and levels chips', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const header = page.getByTestId('spx-header-overlay')
    await expect(header).toBeVisible()
    await expect(page.getByTestId('spx-header-regime-chip')).toBeVisible()
    await expect(page.getByTestId('spx-header-health-chip')).toContainText(/healthy|stale|degraded/i)
    await expect(page.getByTestId('spx-header-feed-chip')).toContainText(/live tick|poll fallback|snapshot fallback|last known good|pending/i)
    await expect(page.getByTestId('spx-header-levels-chip')).toContainText(/focus|all/i)
  })

  test('surfaces degraded snapshot state in health chip', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { snapshotDegraded: true })
    await authenticateAsMember(page)
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('spx-header-health-chip')).toContainText(/degraded/i)
    await expect(page.getByTestId('spx-header-health-reason')).toContainText(/snapshot degraded/i)
  })
})
