import { expect, test, type Page } from '@playwright/test'

import { ACADEMY_V3_FIXTURES, setupAcademyV3Mocks } from './academy-v3-mocks'

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

button[aria-label="Open Next.js Dev Tools"],
button[aria-label="Open issues overlay"],
button[aria-label="Collapse issues badge"],
[data-nextjs-toast],
[data-nextjs-dev-tools-button] {
  display: none !important;
}
`

async function stabilizePage(page: Page): Promise<void> {
  await page.addStyleTag({ content: STABILIZE_CSS })
  await page.evaluate(async () => {
    if ('fonts' in document) {
      await document.fonts.ready
    }
  })
  await page.waitForTimeout(300)
}

async function gotoAcademyModules(page: Page): Promise<void> {
  await page.context().setExtraHTTPHeaders(BYPASS_HEADERS)
  await setupAcademyV3Mocks(page)
  await page.goto(`/members/academy-v3/modules?module=${ACADEMY_V3_FIXTURES.moduleSlugs.execution}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Modules', exact: true })).toBeVisible()
  await expect(page.getByTestId('academy-step-content').getByText('Execution Drill 1')).toBeVisible()
  await stabilizePage(page)
}

test.describe('Academy visual regression', () => {
  test.describe('desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('modules 3-step flow baseline', async ({ page }) => {
      await gotoAcademyModules(page)

      await expect(page).toHaveScreenshot('academy-modules-desktop.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      })
    })
  })

  test.describe('mobile', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test('modules 3-step flow baseline', async ({ page }) => {
      await gotoAcademyModules(page)

      await expect(page).toHaveScreenshot('academy-modules-mobile.png', {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      })
    })
  })
})
