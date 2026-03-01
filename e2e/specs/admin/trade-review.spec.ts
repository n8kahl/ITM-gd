import { expect, test } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { authenticateAsAdmin } from '../../helpers/admin-auth'
import { setupTradeReviewApiMocks, TRADE_REVIEW_ENTRY_ID } from './trade-review-test-helpers'

test.describe('Admin: Trade Review', () => {
  test.beforeEach(async ({ context }) => {
    await authenticateAsAdmin(context)
  })

  test('loads queue and browse tabs', async ({ page }) => {
    await setupTradeReviewApiMocks(page)

    await page.goto('/admin/trade-review', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('main').getByRole('heading', { name: 'Trade Review' })).toBeVisible()
    await expect(page.getByText('Mock Member').first()).toBeVisible()
    await expect(page.getByText('AAPL').first()).toBeVisible()

    await page.getByRole('button', { name: 'Browse All' }).click()
    await expect(page.getByText('TSLA').first()).toBeVisible()
  })

  test('generates AI draft, saves notes, and publishes', async ({ page }) => {
    const state = await setupTradeReviewApiMocks(page)

    await page.goto(`/admin/trade-review/${TRADE_REVIEW_ENTRY_ID}`, { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Trade Review Detail' })).toBeVisible()

    await page.getByRole('button', { name: 'Generate AI Analysis' }).click()
    await expect.poll(() => state.aiGeneratedCount, { timeout: 10_000 }).toBe(1)

    const privateNotes = page.getByPlaceholder('Private coach notes. Never shown to members.')
    await privateNotes.fill('Coach-only follow-up: reinforce early scaling discipline.')

    await page.getByRole('button', { name: 'Save Draft' }).click()
    await expect.poll(() => state.saveCount, { timeout: 10_000 }).toBeGreaterThan(0)

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Publish to Member' }).click()

    await expect.poll(() => state.publishCount, { timeout: 10_000 }).toBe(1)
    await expect(page.getByText('completed').first()).toBeVisible()
  })

  test('dismisses review request from detail workspace', async ({ page }) => {
    const state = await setupTradeReviewApiMocks(page)

    await page.goto(`/admin/trade-review/${TRADE_REVIEW_ENTRY_ID}`, { waitUntil: 'domcontentloaded' })

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Dismiss' }).click()

    await expect.poll(() => state.dismissCount, { timeout: 10_000 }).toBe(1)
  })

  test('renders member screenshot and uploaded coach screenshot', async ({ page }) => {
    const state = await setupTradeReviewApiMocks(page)
    state.entry = {
      ...state.entry,
      screenshot_url: '/logo.png',
    }

    await page.goto(`/admin/trade-review/${TRADE_REVIEW_ENTRY_ID}`, { waitUntil: 'domcontentloaded' })

    await expect(page.getByAltText('AAPL trade screenshot')).toBeVisible()

    await page.locator('input[type="file"]').setInputFiles({
      name: 'coach-screenshot.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6M9xkAAAAASUVORK5CYII=',
        'base64',
      ),
    })

    await expect.poll(() => state.uploadCount, { timeout: 10_000 }).toBe(1)
    await expect(page.getByAltText(`Coach screenshot ${TRADE_REVIEW_ENTRY_ID}`)).toBeVisible()
  })
})
