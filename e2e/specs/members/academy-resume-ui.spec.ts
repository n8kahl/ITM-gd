import { test, expect } from '@playwright/test'

import { ACADEMY_V3_FIXTURES, setupAcademyV3Mocks } from './academy-v3-mocks'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

test.describe('Academy plan recommendations', () => {
  test('loads academy dashboard as canonical continue surface', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto('/members/academy')

    await page.waitForURL('**/members/academy')
    await expect(page.getByRole('heading', { name: 'Your Learning Plan' })).toBeVisible()
  })

  test('recommendation links point to academy routes', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto('/members/academy')

    await expect(page.getByRole('link', { name: 'Start review' })).toHaveAttribute(
      'href',
      '/members/academy/review'
    )
    await expect(page.getByRole('link', { name: 'Open lesson' })).toHaveAttribute(
      'href',
      `/members/academy/lessons/${ACADEMY_V3_FIXTURES.lessonIds.executionOne}`
    )
  })
})
