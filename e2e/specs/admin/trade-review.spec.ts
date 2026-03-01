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

    await page.getByRole('button', { name: 'Preview Member View' }).click()
    await expect(page.getByRole('dialog', { name: 'Preview Member View' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Trade Review Detail' })).toBeVisible()

    const privateNotes = page.getByPlaceholder('Private coach notes. Never shown to members.')
    await privateNotes.fill('Coach-only follow-up: reinforce early scaling discipline.')

    await page.getByRole('button', { name: 'Save Draft' }).click()
    await expect.poll(() => state.saveCount, { timeout: 10_000 }).toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Publish to Member' }).click()
    await page.getByRole('button', { name: 'Confirm Publish' }).click()

    await expect.poll(() => state.publishCount, { timeout: 10_000 }).toBe(1)
    await expect(page.getByText('completed').first()).toBeVisible()
  })

  test('supports keyboard shortcuts in detail workspace', async ({ page }) => {
    const state = await setupTradeReviewApiMocks(page)

    await page.goto(`/admin/trade-review/${TRADE_REVIEW_ENTRY_ID}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Trade Review Detail' })).toBeVisible()

    await page.keyboard.press('ControlOrMeta+g')
    await expect.poll(() => state.aiGeneratedCount, { timeout: 10_000 }).toBe(1)
    await expect(page.getByRole('button', { name: 'Regenerate AI Analysis' })).toBeVisible()

    const privateNotes = page.getByPlaceholder('Private coach notes. Never shown to members.')
    await privateNotes.fill('Keyboard shortcut save attempt.')

    await page.keyboard.press('ControlOrMeta+s')
    await expect.poll(() => state.saveCount, { timeout: 10_000 }).toBeGreaterThan(0)

    await expect(page.getByText('Cmd/Ctrl+S save · Cmd/Ctrl+G generate · Cmd/Ctrl+Enter publish · Esc queue')).toBeVisible()
  })

  test('dismisses review request from detail workspace', async ({ page }) => {
    const state = await setupTradeReviewApiMocks(page)

    await page.goto(`/admin/trade-review/${TRADE_REVIEW_ENTRY_ID}`, { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: 'Dismiss' }).click()
    await page.getByRole('button', { name: 'Confirm Dismiss' }).click()

    await expect.poll(() => state.dismissCount, { timeout: 10_000 }).toBe(1)
  })

  test('shows previous and next review navigation in header', async ({ page }) => {
    await setupTradeReviewApiMocks(page)

    await page.goto(`/admin/trade-review/${TRADE_REVIEW_ENTRY_ID}`, { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('button', { name: 'Previous review' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next review' })).toBeVisible()
    await expect(page.getByText('Prev: MSFT · Mock Member')).toBeVisible()
    await expect(page.getByText('Next: TSLA · Mock Member')).toBeVisible()
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
