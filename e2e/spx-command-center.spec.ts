import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX Command Center', () => {
  test('loads with skeleton, renders core panels, and displays level overlays', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { delayMs: 250 })
    await authenticateAsMember(page)

    const nav = page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Loading')).toBeVisible()
    await nav

    await expect(page.getByRole('heading', { name: 'Institutional Setup Intelligence' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Setup Feed' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Level Matrix' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'AI Coach' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Contract Selector' })).toBeVisible()

    await expect(page.getByText('SPX Call Wall')).toBeVisible()
    await expect(page.locator('canvas').first()).toBeVisible()
  })
})
