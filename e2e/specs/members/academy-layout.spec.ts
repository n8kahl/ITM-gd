import { test, expect } from '@playwright/test'

import { ACADEMY_V3_FIXTURES, setupAcademyV3Mocks } from './academy-v3-mocks'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

test.describe('Academy v3 layout and routing', () => {
  test('loads academy-v3 plan as canonical home', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto('/members/academy-v3')

    await page.waitForURL('**/members/academy-v3')
    await expect(page.getByRole('heading', { name: 'My Learning Plan' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Modules', exact: true })).toBeVisible()
  })

  test('legacy library route redirects to v3 modules', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto('/members/library')

    await page.waitForURL('**/members/academy-v3/modules')
    await expect(page.getByRole('heading', { name: 'Modules' })).toBeVisible()
  })

  test('modules page loads module list and details', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto('/members/academy-v3/modules')

    await expect(page.getByRole('heading', { name: 'Modules' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Module List' })).toBeVisible()

    await page.getByRole('button', { name: new RegExp(ACADEMY_V3_FIXTURES.moduleTitles.execution) }).click()
    await expect(page.getByText('Execution Drill 1')).toBeVisible()
  })
})
