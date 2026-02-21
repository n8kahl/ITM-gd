import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX command palette', () => {
  test('opens and executes stage/exit trade commands', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.addInitScript(() => {
      window.__spxUxFlags = {
        commandPalette: true,
      }
    })

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    await page.getByTestId('spx-command-palette-trigger').click()
    const paletteInput = page.getByPlaceholder('Search commands (stage trade, exit trade, ask coach...)')
    await expect(paletteInput).toBeVisible()

    await paletteInput.fill('stage trade')
    await page.keyboard.press('Enter')

    const focusBanner = page.getByText(/in trade ·/i)
    await expect(focusBanner).toBeVisible()

    await page.getByTestId('spx-command-palette-trigger').click()
    await expect(paletteInput).toBeVisible()
    await paletteInput.fill('exit staged trade')
    await page.keyboard.press('Enter')

    await expect(page.getByText(/in trade ·/i)).toHaveCount(0)
  })
})
