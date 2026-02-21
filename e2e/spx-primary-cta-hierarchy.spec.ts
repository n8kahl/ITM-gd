import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX primary CTA hierarchy', () => {
  test('surfaces one dominant CTA and advances through scan/evaluate/in-trade states', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        layoutStateMachine: true,
        spatialHudV1: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const primaryCta = page.getByTestId('spx-action-primary-cta')
    const initialLabel = (await primaryCta.textContent())?.trim() || ''
    expect(['Select Best Setup', 'Stage Trade']).toContain(initialLabel)

    if (initialLabel === 'Select Best Setup') {
      await primaryCta.click()
      await expect(primaryCta).toContainText('Stage Trade')
    }

    await primaryCta.click()
    await expect(primaryCta).toContainText('Manage Risk / Exit Trade')

    await primaryCta.click()
    await expect(primaryCta).not.toContainText('Manage Risk / Exit Trade')
  })

  test('blocks enter-trade primary CTA when feed trust is degraded', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { snapshotDegraded: true })
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        layoutStateMachine: true,
        spatialHudV1: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const primaryCta = page.getByTestId('spx-action-primary-cta')
    const currentLabel = (await primaryCta.textContent())?.trim() || ''
    if (currentLabel === 'Select Best Setup') {
      await primaryCta.click()
    }

    await expect(primaryCta).toContainText('Stage Trade')
    await expect(primaryCta).toBeDisabled()
    await expect(page.getByTestId('spx-action-primary-cta-blocked-reason')).toContainText(/snapshot degraded/i)
  })
})
