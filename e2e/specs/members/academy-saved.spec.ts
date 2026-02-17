import { test, expect } from '@playwright/test'

import { ACADEMY_V3_FIXTURES, setupAcademyV3Mocks } from './academy-v3-mocks'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

test.describe('Academy module routing', () => {
  test('loads canonical modules page', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto('/members/academy/modules')

    await page.waitForURL('**/members/academy/modules')
    await expect(page.getByRole('heading', { name: 'Modules' })).toBeVisible()
  })

  test('legacy module query maps to canonical module detail', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto(`/members/academy-v3/modules?module=${ACADEMY_V3_FIXTURES.moduleSlugs.execution}`)

    await page.waitForURL(`**/members/academy/modules/${ACADEMY_V3_FIXTURES.moduleSlugs.execution}`)
    await expect(page.getByRole('heading', { name: ACADEMY_V3_FIXTURES.moduleTitles.execution })).toBeVisible()
  })
})
