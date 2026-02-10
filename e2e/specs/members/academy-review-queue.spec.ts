import { test, expect, type Page, type Route } from '@playwright/test'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

interface MockReviewItem {
  id: string
  competency_key: string
  question_data: {
    question: string
    options: string[]
    correct_index: number
    explanation: string
  }
  lesson_title: string
  course_title: string
  due_at: string
}

function buildReviewItems(count: number): MockReviewItem[] {
  const now = Date.now()
  return Array.from({ length: count }).map((_, index) => ({
    id: `review-item-${index + 1}`,
    competency_key: index % 2 === 0 ? 'entry_validation' : 'market_context',
    question_data: {
      question: `Review question ${index + 1}`,
      options: [
        'Wait for confirmation and defined stop',
        'Enter early without structure',
        'Increase size after losses',
        'Remove stop to avoid whipsaw',
      ],
      correct_index: 0,
      explanation: 'Checklist-first confirmation with defined risk is required.',
    },
    lesson_title: `Lesson ${index + 1}`,
    course_title: 'TITM Day Trading Methodology',
    due_at: new Date(now - index * 60_000).toISOString(),
  }))
}

async function setupMemberConfigMocks(page: Page) {
  await page.route('**/api/config/roles', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        'e2e-role-core': 'core',
        'e2e-role-pro': 'pro',
      }),
    })
  })

  await page.route('**/api/config/tabs', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { tab_id: 'dashboard', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 1, label: 'Dashboard', icon: 'layout-dashboard', path: '/members' },
          { tab_id: 'journal', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 2, label: 'Journal', icon: 'book-open', path: '/members/journal' },
          { tab_id: 'ai-coach', required_tier: 'pro', is_active: true, is_required: false, mobile_visible: true, sort_order: 3, label: 'AI Coach', icon: 'bot', path: '/members/ai-coach' },
          { tab_id: 'library', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 4, label: 'Library', icon: 'graduation-cap', path: '/members/academy/courses' },
        ],
      }),
    })
  })
}

async function setupReviewMocks(page: Page, items: MockReviewItem[]) {
  await setupMemberConfigMocks(page)

  let submitCount = 0

  await page.route('**/api/academy/review/submit', async (route: Route) => {
    submitCount += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          queue_item_id: `review-item-${submitCount}`,
          is_correct: true,
          confidence: 4,
          xp_awarded: 5,
          next_due_at: new Date(Date.now() + submitCount * 3_600_000).toISOString(),
          interval_stage: submitCount,
          competency_key: 'entry_validation',
          competency_score: 63,
          mastery_stage: 'applied',
        },
      }),
    })
  })

  await page.route('**/api/academy/review*', async (route: Route) => {
    const request = route.request()
    const method = request.method()
    const pathname = new URL(request.url()).pathname

    if (pathname === '/api/academy/review' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items,
            stats: {
              total_due: items.length,
              estimated_minutes: Math.max(1, items.length * 2),
              weak_competencies: ['entry_validation', 'market_context'],
            },
          },
        }),
      })
      return
    }

    await route.continue()
  })
}

test.describe('Academy review queue', () => {
  test('shows due items when queue items exist', async ({ page }) => {
    await setupReviewMocks(page, buildReviewItems(3))

    await page.goto('/members/academy/review')

    await expect(page.getByRole('heading', { name: 'Spaced Repetition Session' })).toBeVisible()
    await expect(page.getByText('Due Now')).toBeVisible()
    await expect(page.getByText('3 items due right now.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start Review' })).toBeEnabled()
  })

  test('completing a review item shows answer feedback', async ({ page }) => {
    await setupReviewMocks(page, buildReviewItems(1))

    await page.goto('/members/academy/review')
    await page.getByRole('button', { name: 'Start Review' }).click()

    await expect(page.getByRole('heading', { name: 'Review question 1' })).toBeVisible()
    await page.getByRole('button', { name: 'Wait for confirmation and defined stop' }).click()
    await page.getByRole('button', { name: 'Check Answer' }).click()

    await expect(page.getByText('Correct')).toBeVisible()
    await expect(page.getByText('Checklist-first confirmation with defined risk is required.')).toBeVisible()
  })

  test('confidence slider accepts updates before submit', async ({ page }) => {
    await setupReviewMocks(page, buildReviewItems(1))

    await page.goto('/members/academy/review')
    await page.getByRole('button', { name: 'Start Review' }).click()
    await page.getByRole('button', { name: 'Wait for confirmation and defined stop' }).click()
    await page.getByRole('button', { name: 'Check Answer' }).click()

    const confidenceSlider = page.locator('input[type="range"]')
    await expect(confidenceSlider).toBeVisible()
    await confidenceSlider.evaluate((node) => {
      const input = node as HTMLInputElement
      input.value = '5'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await expect(confidenceSlider).toHaveValue('5')
    await expect(page.getByRole('button', { name: 'Finish Session' })).toBeEnabled()
  })

  test('session summary appears after all queue items are reviewed', async ({ page }) => {
    await setupReviewMocks(page, buildReviewItems(1))

    await page.goto('/members/academy/review')
    await page.getByRole('button', { name: 'Start Review' }).click()

    await page.locator('button:enabled', { hasText: 'Wait for confirmation and defined stop' }).first().click()
    await page.getByRole('button', { name: 'Check Answer' }).click()
    await page.getByRole('button', { name: 'Finish Session' }).click()

    await expect(page.getByText('Session Complete')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Review Summary' })).toBeVisible()
    await expect(page.getByText('Items Reviewed')).toBeVisible()
  })

  test('shows an empty state when no items are due', async ({ page }) => {
    await setupReviewMocks(page, [])

    await page.goto('/members/academy/review')

    await expect(page.getByRole('heading', { name: 'No items are due yet' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'No Items Due' })).toBeDisabled()
  })
})
