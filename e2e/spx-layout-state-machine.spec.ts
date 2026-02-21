import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX layout state machine', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('mobile smart stack renders unified sections and transitions into in-trade mode', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        layoutStateMachine: true,
        mobileSmartStack: true,
        mobileFullTradeFocus: true,
        oneClickEntry: true,
        coachDockV1: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const smartStack = page.getByTestId('spx-mobile-smart-stack')
    await expect(smartStack).toBeVisible()
    await expect(page.getByRole('button', { name: 'Brief' })).toHaveCount(0)

    await expect(page.getByRole('heading', { name: 'Setup Feed' })).toBeVisible()
    await expect(page.getByText('Price + Levels')).toBeVisible()
    await expect(page.getByTestId('spx-coach-dock-mobile')).toBeVisible()
    await page.getByTestId('spx-coach-dock-toggle-mobile').click()
    await expect(page.getByTestId('spx-coach-bottom-sheet')).toBeVisible()
    await page.getByTestId('spx-coach-bottom-sheet-close').click()
    await expect(page.getByTestId('spx-coach-bottom-sheet')).toHaveCount(0)
    await expect(page.getByTestId('spx-mobile-layout-mode-chip')).toHaveText(/evaluate/i)

    await page.getByTestId('spx-mobile-primary-cta-button').click()
    await expect(page.getByTestId('spx-mobile-layout-mode-chip')).toHaveText(/in trade/i)
    await expect(page.getByText(/in trade ·/i).first()).toBeVisible()
  })
})
