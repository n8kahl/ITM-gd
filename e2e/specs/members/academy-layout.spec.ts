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

  test('modules page presents a clear 3-step learning flow on desktop and mobile', async ({ page }) => {
    await setupAcademyV3Mocks(page)

    await page.goto('/members/academy-v3/modules')

    await expect(page.getByRole('heading', { name: 'Modules' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Step 1 .*Modules/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Step 2 .*Lessons/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Step 3 .*Lesson Content/i })).toBeVisible()

    const modulesStep = page.getByTestId('academy-step-modules')
    const lessonsStep = page.getByTestId('academy-step-lessons')
    const contentStep = page.getByTestId('academy-step-content')

    await expect(modulesStep).toBeVisible()
    await expect(lessonsStep).toBeVisible()
    await expect(contentStep).toBeVisible()

    const modulesBox = await modulesStep.boundingBox()
    const lessonsBox = await lessonsStep.boundingBox()
    const contentBox = await contentStep.boundingBox()

    expect(modulesBox).not.toBeNull()
    expect(lessonsBox).not.toBeNull()
    expect(contentBox).not.toBeNull()

    const viewport = page.viewportSize()
    if (viewport && viewport.width >= 1024) {
      expect(modulesBox!.x).toBeLessThan(lessonsBox!.x)
      expect(lessonsBox!.x).toBeLessThan(contentBox!.x)
    } else {
      expect(modulesBox!.y).toBeLessThan(lessonsBox!.y)
      expect(lessonsBox!.y).toBeLessThan(contentBox!.y)
    }

    await page.getByRole('button', { name: new RegExp(ACADEMY_V3_FIXTURES.moduleTitles.execution) }).click()
    await expect(page.getByText('Execution Drill 1')).toBeVisible()
    await expect(page.getByText('Execution Sequence')).toBeVisible()
  })
})
