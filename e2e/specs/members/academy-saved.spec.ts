import { test, expect } from '@playwright/test'

import { ACADEMY_V3_FIXTURES, setupAcademyV3Mocks } from './academy-v3-mocks'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

test.describe('Academy v3 module routing', () => {
  test('loads canonical modules page', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto('/members/academy-v3/modules')

    await page.waitForURL('**/members/academy-v3/modules')
    await expect(page.getByRole('heading', { name: 'Modules' })).toBeVisible()
  })

  test('module query maps to requested module details', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto(`/members/academy-v3/modules?module=${ACADEMY_V3_FIXTURES.moduleSlugs.execution}`)

    await page.waitForURL(`**/members/academy-v3/modules?module=${ACADEMY_V3_FIXTURES.moduleSlugs.execution}`)
    await expect(page.getByTestId('academy-step-content').getByText('Execution Drill 1')).toBeVisible()
  })
})
