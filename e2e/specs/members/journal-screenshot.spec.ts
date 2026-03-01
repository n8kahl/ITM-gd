import { expect, test, type Page } from '@playwright/test'
import {
  E2E_USER_ID,
  enableMemberBypass,
  setupJournalCrudMocks,
  setupMemberShellMocks,
} from './journal-test-helpers'

const JOURNAL_URL = '/members/journal?e2eBypassAuth=1'

async function seedSupabaseClientSessionMock(page: Page) {
  await page.evaluate((userId) => {
    ;(globalThis as Record<string, unknown>).__supabase_browser_client = {
      auth: {
        getSession: async () => ({
          data: {
            session: {
              access_token: 'e2e-test-access-token',
              user: { id: userId },
            },
          },
        }),
        getUser: async () => ({ data: { user: { id: userId } } }),
      },
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
          remove: async () => ({ error: null }),
        }),
      },
    }
  }, E2E_USER_ID)
}

async function setupScreenshotPipelineMocks(page: Page) {
  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: E2E_USER_ID,
        email: 'member@example.com',
      }),
    })
  })

  await page.route('**/storage/v1/object/journal-screenshots/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        Key: 'mock-uploaded-object',
      }),
    })
  })

  await page.route('**/api/members/journal/screenshot-url', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    const payload = route.request().postDataJSON() as { storagePath?: string }
    const storagePath = payload.storagePath ?? `${E2E_USER_ID}/new/mock-upload.png`

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          signedUrl: '/logo.png',
          storagePath,
        },
      }),
    })
  })

  await page.route('**/api/screenshot/analyze', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        positions: [
          {
            symbol: 'SPX',
            type: 'call',
            strike: 6100,
            expiry: '2026-02-20',
            quantity: 1,
            entryPrice: 22.5,
            currentPrice: 24.1,
            pnl: 160,
            confidence: 0.88,
          },
        ],
        positionCount: 1,
        intent: 'single_position',
        suggestedActions: [
          {
            id: 'analyze_next_steps',
            label: 'Analyze Next Steps',
            description: 'Get a tactical next-step plan based on current position context.',
          },
          {
            id: 'log_trade',
            label: 'Log Trade',
            description: 'Create or update journal entries from this screenshot.',
          },
        ],
        warnings: [],
      }),
    })
  })
}

async function mockScreenshotAnalyze(
  page: Page,
  payload: Record<string, unknown>,
) {
  await page.route('**/api/screenshot/analyze', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })
}

test.describe('Trade Journal Screenshot UI', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
    await setupJournalCrudMocks(page, [])
  })

  test('opens and closes quick screenshot entry dialog', async ({ page }) => {
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: 'Screenshot' }).click()
    await expect(page.getByRole('heading', { name: 'Quick Screenshot Entry' })).toBeVisible()

    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('heading', { name: 'Quick Screenshot Entry' })).toHaveCount(0)
  })

  test('rejects unsupported file types before upload', async ({ page }) => {
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: 'Screenshot' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'not-an-image.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image', 'utf-8'),
    })

    await expect(page.getByText('Please select a PNG, JPEG, or WebP image')).toBeVisible()
  })

  test('launching screenshot flow hides import wizard', async ({ page }) => {
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: 'Import' }).click()
    await expect(page.getByText('Import Wizard')).toBeVisible()

    await page.getByRole('button', { name: 'Screenshot' }).click()
    await expect(page.getByRole('heading', { name: 'Quick Screenshot Entry' })).toBeVisible()
    await expect(page.getByText('Import Wizard')).toHaveCount(0)
  })

  test('analyzes screenshot and applies extracted symbol in quick add flow', async ({ page }) => {
    await setupJournalCrudMocks(page, [])
    await setupScreenshotPipelineMocks(page)

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })
    await seedSupabaseClientSessionMock(page)

    await page.getByRole('button', { name: 'Screenshot' }).click()
    await expect(page.getByRole('heading', { name: 'Quick Screenshot Entry' })).toBeVisible()

    await page.locator('[role="dialog"] input[type="file"]').setInputFiles({
      name: 'position.png',
      mimeType: 'image/png',
      buffer: Buffer.from('mock-png', 'utf-8'),
    })

    await expect(page.getByText('Found 1 position')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Analyze Next Steps' })).toBeVisible()

    await page.getByRole('dialog').getByRole('button', { name: 'Use' }).click()
    await expect(page.locator('[role="dialog"] input[placeholder="e.g., AAPL"]')).toHaveValue('SPX')
  })

  test('creates entry from quick screenshot flow with persisted screenshot path', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])
    await setupScreenshotPipelineMocks(page)

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })
    await seedSupabaseClientSessionMock(page)

    await page.getByRole('button', { name: 'Screenshot' }).click()
    await expect(page.getByRole('heading', { name: 'Quick Screenshot Entry' })).toBeVisible()

    await page.locator('[role="dialog"] input[type="file"]').setInputFiles({
      name: 'position.png',
      mimeType: 'image/png',
      buffer: Buffer.from('mock-png', 'utf-8'),
    })

    await page.locator('[role="dialog"] input[placeholder="e.g., AAPL"]').fill('SPX')
    await page.getByRole('button', { name: 'Create Entry' }).click()

    await expect(page.getByRole('heading', { name: 'Quick Screenshot Entry' })).toHaveCount(0)

    await expect.poll(() => {
      const created = state.entries[0]
      if (!created) return null
      return {
        symbol: created.symbol,
        hasPath: typeof created.screenshot_storage_path === 'string' && created.screenshot_storage_path.startsWith(`${E2E_USER_ID}/`),
        hasUrl: typeof created.screenshot_url === 'string' && created.screenshot_url.length > 0,
      }
    }, { timeout: 10_000 }).toEqual({
      symbol: 'SPX',
      hasPath: true,
      hasUrl: true,
    })
  })

  test('requires explicit symbol when screenshot contains multiple positions', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])
    await setupScreenshotPipelineMocks(page)
    await mockScreenshotAnalyze(page, {
      positions: [
        {
          symbol: 'MULTIPLE',
          type: 'stock',
          quantity: 1,
          entryPrice: 0,
          confidence: 0.5,
        },
      ],
      positionCount: 2,
      intent: 'portfolio',
      suggestedActions: [],
      warnings: ['Multiple positions detected.'],
    })

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })
    await seedSupabaseClientSessionMock(page)

    await page.getByRole('button', { name: 'Screenshot' }).click()
    await page.locator('[role="dialog"] input[type="file"]').setInputFiles({
      name: 'portfolio.png',
      mimeType: 'image/png',
      buffer: Buffer.from('mock-png', 'utf-8'),
    })

    await expect(page.getByText(/Found 2 positions/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Entry' })).toBeDisabled()

    await expect.poll(() => state.entries.length, { timeout: 10_000 }).toBe(0)
  })

  test('allows manual symbol entry when screenshot returns no positions', async ({ page }) => {
    const state = await setupJournalCrudMocks(page, [])
    await setupScreenshotPipelineMocks(page)
    await mockScreenshotAnalyze(page, {
      positions: [],
      positionCount: 0,
      intent: 'unknown',
      suggestedActions: [],
      warnings: ['No clear trade position detected.'],
    })

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })
    await seedSupabaseClientSessionMock(page)

    await page.getByRole('button', { name: 'Screenshot' }).click()
    await page.locator('[role="dialog"] input[type="file"]').setInputFiles({
      name: 'random-chart.png',
      mimeType: 'image/png',
      buffer: Buffer.from('mock-png', 'utf-8'),
    })

    await expect(page.getByText(/Found 0 positions/i)).toBeVisible()
    await page.getByRole('dialog').locator('input[placeholder="e.g., AAPL"]').fill('TSLA')
    await page.getByRole('button', { name: 'Create Entry' }).click()

    await expect(page.getByRole('heading', { name: 'Quick Screenshot Entry' })).toHaveCount(0)
    await expect.poll(() => state.entries[0]?.symbol ?? null, { timeout: 10_000 }).toBe('TSLA')
  })

  test('lets full form pick one position when screenshot has multiple positions', async ({ page }) => {
    await setupJournalCrudMocks(page, [])
    await setupScreenshotPipelineMocks(page)
    await mockScreenshotAnalyze(page, {
      positions: [
        {
          symbol: 'AAPL',
          type: 'stock',
          quantity: 10,
          entryPrice: 180.25,
          confidence: 0.84,
        },
        {
          symbol: 'TSLA',
          type: 'call',
          strike: 250,
          expiry: '2026-04-17',
          quantity: 1,
          entryPrice: 8.2,
          confidence: 0.81,
        },
      ],
      positionCount: 2,
      intent: 'portfolio',
      suggestedActions: [],
      warnings: ['Multiple positions detected.'],
    })

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })
    await seedSupabaseClientSessionMock(page)

    await page.getByRole('button', { name: 'New Entry' }).click()
    await page.getByRole('button', { name: 'Full Form' }).click()

    const tradeDialog = page.locator('[role="dialog"]').first()
    const screenshotSection = tradeDialog.locator('details').filter({ hasText: 'Screenshot' })
    await screenshotSection.locator('summary').click()
    await screenshotSection.locator('input[type="file"]').setInputFiles({
      name: 'portfolio.png',
      mimeType: 'image/png',
      buffer: Buffer.from('mock-png', 'utf-8'),
    })

    await expect(screenshotSection.getByText(/Found 2 positions/i)).toBeVisible()
    await expect(screenshotSection.getByRole('button', { name: 'Applied' })).toBeVisible()

    await screenshotSection.getByRole('button', { name: 'Use TSLA' }).click()
    await expect(tradeDialog.locator('input[placeholder="AAPL"]')).toHaveValue('TSLA')

    await screenshotSection.getByRole('button', { name: 'Use AAPL' }).click()
    await expect(tradeDialog.locator('input[placeholder="AAPL"]')).toHaveValue('AAPL')
  })
})
