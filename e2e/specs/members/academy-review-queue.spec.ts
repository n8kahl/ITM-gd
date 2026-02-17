import { test, expect } from '@playwright/test'

import { setupAcademyV3Mocks } from './academy-v3-mocks'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

test.describe('Academy review queue', () => {
  test('shows due items and accepts review submissions', async ({ page }) => {
    await setupAcademyV3Mocks(page, { reviewItemCount: 2 })

    await page.goto('/members/academy/review')

    await expect(page.getByRole('heading', { name: 'Review Queue' })).toBeVisible()
    await expect(page.getByText('2 due items')).toBeVisible()

    await page.getByPlaceholder('Type your answer...').first().fill('Define risk and invalidation first.')
    await page.getByRole('button', { name: 'Submit review answer' }).first().click()

    await expect(page.getByText('Marked correct and rescheduled.')).toBeVisible()
    await expect(page.getByText('1 due items')).toBeVisible()
  })

  test('shows queue-clear state when no items are due', async ({ page }) => {
    await setupAcademyV3Mocks(page, { reviewItemCount: 0 })

    await page.goto('/members/academy/review')

    await expect(page.getByText('Queue clear. You are caught up for now.')).toBeVisible()
    await expect(page.getByText('No review items due.')).toBeVisible()
  })
})
