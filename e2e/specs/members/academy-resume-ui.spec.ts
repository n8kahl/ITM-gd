import { test, expect } from '@playwright/test'

import { ACADEMY_V3_FIXTURES, setupAcademyV3Mocks } from './academy-v3-mocks'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

test.describe('Academy v3 plan recommendations', () => {
  test('loads academy-v3 plan as canonical continue surface', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto('/members/academy-v3')

    await page.waitForURL('**/members/academy-v3')
    await expect(page.getByRole('heading', { name: 'My Learning Plan' })).toBeVisible()
  })

  test('recommendation links point to v3 routes', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto('/members/academy-v3')

    await expect(page.getByRole('link', { name: 'Start review' })).toHaveAttribute(
      'href',
      '/members/academy-v3/review'
    )
    await expect(page.getByRole('link', { name: 'Open lesson' })).toHaveAttribute(
      'href',
      `/members/academy-v3/modules?lesson=${ACADEMY_V3_FIXTURES.lessonIds.executionOne}`
    )
  })
})
