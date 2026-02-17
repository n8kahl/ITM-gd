import { test, expect } from '@playwright/test'

import { ACADEMY_V3_FIXTURES, setupAcademyV3Mocks } from './academy-v3-mocks'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

test.describe('Academy v3 module preselection', () => {
  test('module query preselects the requested module', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto(`/members/academy-v3/modules?module=${ACADEMY_V3_FIXTURES.moduleSlugs.execution}`)

    await expect(page.getByRole('heading', { name: 'Modules' })).toBeVisible()
    await expect(page.getByText('Execution Drill 1')).toBeVisible()
  })

  test('lesson query preselects the parent module for that lesson', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto(`/members/academy-v3/modules?lesson=${ACADEMY_V3_FIXTURES.lessonIds.executionOne}`)

    await page.waitForURL(`**/members/academy-v3/modules?lesson=${ACADEMY_V3_FIXTURES.lessonIds.executionOne}`)
    await expect(page.getByText('Execution Drill 1')).toBeVisible()
  })
})
