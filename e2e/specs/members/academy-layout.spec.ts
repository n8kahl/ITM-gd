import { test, expect } from '@playwright/test'

import { ACADEMY_V3_FIXTURES, setupAcademyV3Mocks } from './academy-v3-mocks'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

test.describe('Academy layout and routing', () => {
  test('loads academy dashboard as canonical home', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto('/members/academy')

    await page.waitForURL('**/members/academy')
    await expect(page.getByRole('heading', { name: 'Your Learning Plan' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Modules', exact: true })).toBeVisible()
  })

  test('legacy routes redirect to academy dashboard', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto('/members/library')
    await page.waitForURL('**/members/academy')
    await expect(page.getByRole('heading', { name: 'Your Learning Plan' })).toBeVisible()

    await page.goto('/members/academy-v3')
    await page.waitForURL('**/members/academy')
    await expect(page.getByRole('heading', { name: 'Your Learning Plan' })).toBeVisible()
  })

  test('modules page presents track-grouped cards and no step panels', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto('/members/academy/modules')

    await expect(page.getByRole('heading', { name: 'Modules' })).toBeVisible()
    await expect(page.getByText('Core Execution').first()).toBeVisible()
    await expect(page.getByText('Step 1')).toHaveCount(0)
    await expect(page.getByText('Step 2')).toHaveCount(0)
    await expect(page.getByText('Step 3')).toHaveCount(0)

    await page.getByRole('link', { name: new RegExp(ACADEMY_V3_FIXTURES.moduleTitles.execution) }).first().click()
    await page.waitForURL(`**/members/academy/modules/${ACADEMY_V3_FIXTURES.moduleSlugs.execution}`)
    await expect(page.getByRole('heading', { name: ACADEMY_V3_FIXTURES.moduleTitles.execution })).toBeVisible()

    await page.getByRole('link', { name: /Execution Drill 1/ }).click()
    await page.waitForURL(`**/members/academy/lessons/${ACADEMY_V3_FIXTURES.lessonIds.executionOne}`)
    await expect(page.getByRole('heading', { name: 'Lesson Viewer' })).toBeVisible()
    await expect(page.getByText('Execution Sequence')).toBeVisible()
  })
})
