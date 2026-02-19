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

  test('auto-sees routine coach alert and persists lifecycle across reload', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { delayMs: 100 })
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'networkidle' })

    await page.getByTestId('spx-ai-coach-feed').getByRole('button', { name: 'All' }).click()
    await expect(page.getByTestId('spx-ai-coach-pinned-alert')).toBeVisible()
    await expect(page.getByTestId('spx-action-strip-alert')).toHaveCount(0)

    await expect(page.getByTestId('spx-ai-coach-pinned-alert')).toHaveCount(0, { timeout: 6_000 })
    const lifecycleBeforeReload = await page.evaluate(() => {
      const raw = window.localStorage.getItem('spx.coach.alert.lifecycle.v2')
      if (!raw) return {}
      try {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
      } catch {
        return {}
      }
    })
    const seenBeforeReload = Object.entries(lifecycleBeforeReload)
      .filter(([, record]) => {
        if (!record || typeof record !== 'object') return false
        return (record as { status?: unknown }).status === 'seen'
      })
      .map(([id]) => id)
    expect(seenBeforeReload.length).toBeGreaterThan(0)

    await page.reload({ waitUntil: 'networkidle' })
    await page.getByTestId('spx-ai-coach-feed').getByRole('button', { name: 'All' }).click()
    await expect(page.getByTestId('spx-ai-coach-pinned-alert')).toHaveCount(0)
    const lifecycleAfterReload = await page.evaluate(() => {
      const raw = window.localStorage.getItem('spx.coach.alert.lifecycle.v2')
      if (!raw) return {}
      try {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
      } catch {
        return {}
      }
    })
    for (const id of seenBeforeReload) {
      const entry = (lifecycleAfterReload as Record<string, { status?: unknown }>)[id]
      expect(entry?.status).toBe('seen')
    }
  })
})
