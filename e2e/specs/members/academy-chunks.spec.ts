import { test, expect } from '@playwright/test'

import { ACADEMY_V3_FIXTURES, setupAcademyV3Mocks } from './academy-v3-mocks'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

test.describe('Academy module and lesson deep links', () => {
  test('module slug route loads requested module detail', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto(`/members/academy/modules/${ACADEMY_V3_FIXTURES.moduleSlugs.execution}`)

    await expect(page.getByRole('heading', { name: ACADEMY_V3_FIXTURES.moduleTitles.execution })).toBeVisible()
    await expect(page.getByRole('link', { name: /Execution Drill 1/ })).toBeVisible()
  })

  test('legacy lesson query redirects to canonical lesson route', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto(`/members/academy-v3/modules?lesson=${ACADEMY_V3_FIXTURES.lessonIds.executionOne}`)

    await page.waitForURL(`**/members/academy/lessons/${ACADEMY_V3_FIXTURES.lessonIds.executionOne}`)
    await expect(page.getByRole('heading', { name: 'Lesson Viewer' })).toBeVisible()
    await expect(page.getByText('Execution Sequence')).toBeVisible()
  })
})
