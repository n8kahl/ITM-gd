import { expect, test, type Page } from '@playwright/test'

const BYPASS_HEADERS = {
  'x-e2e-bypass-auth': '1',
}

const STABILIZE_CSS = `
*,
*::before,
*::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition: none !important;
  caret-color: transparent !important;
}
`

test.describe('Visual Regression', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  async function stabilizePage(page: Page): Promise<void> {
    await page.addStyleTag({ content: STABILIZE_CSS })
    await page.evaluate(async () => {
      if ('fonts' in document) {
        await document.fonts.ready
      }
    })
    await page.waitForTimeout(300)
  }

  async function gotoMemberPage(page: Page, path: string): Promise<void> {
    await page.context().setExtraHTTPHeaders(BYPASS_HEADERS)
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await stabilizePage(page)
  }

  test('landing page baseline', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('titm_modal_seen', 'true')
    })

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible()
    await stabilizePage(page)

    await expect(page).toHaveScreenshot('landing-page.png', {
      maxDiffPixelRatio: 0.03,
      mask: [page.locator('canvas'), page.locator('video')],
    })
  })

  test('login page baseline', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /Log in with Discord/i })).toBeVisible()
    await stabilizePage(page)

    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
      mask: [page.locator('canvas'), page.locator('video')],
    })
  })

  test('members dashboard baseline', async ({ page }) => {
    await gotoMemberPage(page, '/members')

    await expect(page).toHaveScreenshot('members-dashboard-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      mask: [page.locator('[aria-label="Live market ticker"]')],
    })
  })

  test('journal page baseline', async ({ page }) => {
    await gotoMemberPage(page, '/members/journal')

    await expect(page).toHaveScreenshot('journal-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    })
  })

  test('ai coach page baseline', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ai-coach-onboarding-complete', 'true')
    })

    await gotoMemberPage(page, '/members/ai-coach')

    await expect(page).toHaveScreenshot('ai-coach-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    })
  })
})
