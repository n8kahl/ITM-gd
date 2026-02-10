import { test, expect, type Page, type Route } from '@playwright/test'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

const CHUNK_LESSON_ID = 'chunk-lesson-1'
const MARKDOWN_LESSON_ID = 'markdown-lesson-1'
const COURSE_SLUG = 'chunk-course-alpha'

function buildChunkLessonPayload() {
  return {
    success: true,
    data: {
      id: CHUNK_LESSON_ID,
      title: 'Chunk Lesson Alpha',
      content: '',
      contentType: 'mixed',
      chunkData: [
        {
          id: `${CHUNK_LESSON_ID}-c1`,
          title: 'Market Structure Setup',
          content_type: 'rich_text',
          content: '## Market Structure Setup\n\nDefine levels, trigger, and invalidation before entry.',
          duration_minutes: 3,
          order_index: 0,
        },
        {
          id: `${CHUNK_LESSON_ID}-c2`,
          title: 'Quick Scenario Check',
          content_type: 'quick_check',
          content: '',
          duration_minutes: 3,
          order_index: 1,
          quick_check: {
            question: 'What must be defined before entry?',
            options: [
              'Risk and invalidation',
              'Position size after entry',
              'Average down plan',
              'Ignore stop to avoid noise',
            ],
            correct_index: 0,
            explanation: 'Risk and invalidation must be defined before entry.',
          },
        },
        {
          id: `${CHUNK_LESSON_ID}-c3`,
          title: 'Apply the Drill',
          content_type: 'applied_drill',
          content: '## Applied Drill\n\nSimulate one setup and journal entry/stop/target.',
          duration_minutes: 4,
          order_index: 2,
        },
        {
          id: `${CHUNK_LESSON_ID}-c4`,
          title: 'Reflection Prompt',
          content_type: 'reflection',
          content: 'What checklist line prevented your highest-probability mistake?',
          duration_minutes: 2,
          order_index: 3,
        },
      ],
      videoUrl: null,
      durationMinutes: 12,
      order: 1,
      isCompleted: false,
      course: {
        slug: COURSE_SLUG,
        title: 'Chunk Course Alpha',
        lessons: [
          {
            id: CHUNK_LESSON_ID,
            title: 'Chunk Lesson Alpha',
            order: 1,
            durationMinutes: 12,
            isCompleted: false,
            isLocked: false,
          },
          {
            id: MARKDOWN_LESSON_ID,
            title: 'Legacy Markdown Lesson',
            order: 2,
            durationMinutes: 10,
            isCompleted: false,
            isLocked: false,
          },
        ],
      },
      quiz: null,
    },
  }
}

function buildMarkdownLessonPayload() {
  return {
    success: true,
    data: {
      id: MARKDOWN_LESSON_ID,
      title: 'Legacy Markdown Lesson',
      content: '## Legacy Markdown Lesson\n\nLegacy markdown lessons remain supported.',
      contentType: 'markdown',
      chunkData: null,
      videoUrl: null,
      durationMinutes: 10,
      order: 2,
      isCompleted: false,
      course: {
        slug: COURSE_SLUG,
        title: 'Chunk Course Alpha',
        lessons: [
          {
            id: CHUNK_LESSON_ID,
            title: 'Chunk Lesson Alpha',
            order: 1,
            durationMinutes: 12,
            isCompleted: false,
            isLocked: false,
          },
          {
            id: MARKDOWN_LESSON_ID,
            title: 'Legacy Markdown Lesson',
            order: 2,
            durationMinutes: 10,
            isCompleted: false,
            isLocked: false,
          },
        ],
      },
      quiz: null,
    },
  }
}

async function setupMemberConfigMocks(page: Page) {
  await page.route('**/api/config/roles', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        'e2e-role-core': 'core',
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
          { tab_id: 'library', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 4, label: 'Library', icon: 'graduation-cap', path: '/members/academy/courses' },
        ],
      }),
    })
  })
}

async function setupChunkMocks(page: Page) {
  await setupMemberConfigMocks(page)

  await page.route('**/api/academy/saved', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [] } }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { saved: true } }),
    })
  })

  await page.route('**/api/academy/lessons/**', async (route: Route) => {
    const request = route.request()
    const method = request.method()
    const pathname = new URL(request.url()).pathname

    if (method === 'POST' && pathname.endsWith('/progress')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { action: 'view', xp_awarded: 0 },
        }),
      })
      return
    }

    if (method === 'POST' && pathname.endsWith('/quiz')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
      return
    }

    const lessonMatch = pathname.match(/\/api\/academy\/lessons\/([^/]+)$/)
    if (method === 'GET' && lessonMatch?.[1]) {
      const lessonId = lessonMatch[1]
      const payload = lessonId === MARKDOWN_LESSON_ID
        ? buildMarkdownLessonPayload()
        : buildChunkLessonPayload()

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      })
      return
    }

    await route.continue()
  })
}

test.describe('Academy chunk lesson renderer', () => {
  test('renders chunk progress dots for chunk-based lessons', async ({ page }) => {
    await setupChunkMocks(page)

    await page.goto(`/members/academy/learn/${CHUNK_LESSON_ID}`)

    await expect(page.getByTestId('lesson-chunk-renderer')).toBeVisible()
    await expect(page.getByText('Chunk 1 of 4')).toBeVisible()
    await expect(page.locator('button[aria-label^="Go to chunk "]')).toHaveCount(4)
  })

  test('navigates between chunks using next/previous controls', async ({ page }) => {
    await setupChunkMocks(page)

    await page.goto(`/members/academy/learn/${CHUNK_LESSON_ID}`)
    await page.getByRole('button', { name: 'Next Chunk' }).click()
    await expect(page.getByRole('heading', { name: 'Quick Scenario Check' })).toBeVisible()

    await page.getByRole('button', { name: 'Previous' }).click()
    await expect(page.getByRole('heading', { name: 'Market Structure Setup' }).first()).toBeVisible()
  })

  test('blocks chunk progress on quick check until an answer is selected', async ({ page }) => {
    await setupChunkMocks(page)

    await page.goto(`/members/academy/learn/${CHUNK_LESSON_ID}`)
    await page.getByRole('button', { name: 'Next Chunk' }).click()
    await expect(page.getByRole('heading', { name: 'Quick Scenario Check' })).toBeVisible()

    const nextButton = page.getByRole('button', { name: 'Next Chunk' })
    await expect(nextButton).toBeDisabled()
    await expect(page.getByText('Answer the quick check to continue.')).toBeVisible()

    await page.getByRole('button', { name: 'Risk and invalidation' }).click()
    await expect(nextButton).toBeEnabled()
    await page.getByRole('button', { name: 'Next Chunk' }).click()
    await expect(page.getByRole('heading', { name: 'Apply the Drill' })).toBeVisible()
  })

  test('renders applied drill content with a journal link', async ({ page }) => {
    await setupChunkMocks(page)

    await page.goto(`/members/academy/learn/${CHUNK_LESSON_ID}`)
    await page.getByRole('button', { name: 'Next Chunk' }).click()
    await page.getByRole('button', { name: 'Risk and invalidation' }).click()
    await page.getByRole('button', { name: 'Next Chunk' }).click()

    await expect(page.getByRole('heading', { name: 'Apply the Drill' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open Journal' })).toHaveAttribute(
      'href',
      `/members/journal?academy_lesson=${CHUNK_LESSON_ID}&academy_chunk=${CHUNK_LESSON_ID}-c3`
    )
  })

  test('keeps backward compatibility for non-chunk markdown lessons', async ({ page }) => {
    await setupChunkMocks(page)

    await page.goto(`/members/academy/learn/${MARKDOWN_LESSON_ID}`)

    await expect(page.getByRole('heading', { name: 'Legacy Markdown Lesson' }).first()).toBeVisible()
    await expect(page.getByText('Legacy markdown lessons remain supported.')).toBeVisible()
    await expect(page.getByTestId('lesson-chunk-renderer')).toHaveCount(0)
  })
})
