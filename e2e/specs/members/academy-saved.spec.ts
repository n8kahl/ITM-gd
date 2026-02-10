import { test, expect, type Page, type Route } from '@playwright/test'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

const COURSE_ID = 'course-saved-1'
const COURSE_SLUG = 'saved-course-alpha'
const COURSE_TITLE = 'Saved Course Alpha'
const LESSON_ID = 'lesson-saved-1'
const LESSON_TITLE = 'Saved Lesson Alpha'

function buildCourseCatalogResponse() {
  return {
    success: true,
    data: {
      courses: [
        {
          id: COURSE_ID,
          slug: COURSE_SLUG,
          title: COURSE_TITLE,
          description: 'Course used for saved-item Playwright verification.',
          thumbnailUrl: null,
          difficulty: 'beginner',
          path: 'Foundations',
          totalLessons: 6,
          completedLessons: 1,
          estimatedMinutes: 75,
          skills: ['Entry Validation'],
          microLearningAvailable: true,
          isSaved: false,
        },
      ],
      paths: ['Foundations'],
      trending: [],
      micro_lessons: [],
    },
  }
}

function buildSavedItemsResponse(savedCourseIds: Set<string>, savedLessonIds: Set<string>) {
  const items: Array<Record<string, unknown>> = []

  for (const courseId of savedCourseIds) {
    items.push({
      id: `saved-course-${courseId}`,
      entity_type: 'course',
      entity_id: courseId,
      created_at: new Date().toISOString(),
      course: {
        id: courseId,
        slug: COURSE_SLUG,
        title: COURSE_TITLE,
        description: 'Course used for saved-item Playwright verification.',
      },
      lesson: null,
    })
  }

  for (const lessonId of savedLessonIds) {
    items.push({
      id: `saved-lesson-${lessonId}`,
      entity_type: 'lesson',
      entity_id: lessonId,
      created_at: new Date().toISOString(),
      course: null,
      lesson: {
        id: lessonId,
        title: LESSON_TITLE,
        course_slug: COURSE_SLUG,
        course_title: COURSE_TITLE,
      },
    })
  }

  return {
    success: true,
    data: {
      items,
    },
  }
}

function buildLessonPayload() {
  return {
    success: true,
    data: {
      id: LESSON_ID,
      title: LESSON_TITLE,
      content: '## Saved Lesson Alpha\n\nLesson body for save-state coverage.',
      contentType: 'markdown',
      chunkData: null,
      videoUrl: null,
      durationMinutes: 12,
      order: 1,
      isCompleted: false,
      course: {
        slug: COURSE_SLUG,
        title: COURSE_TITLE,
        lessons: [
          {
            id: LESSON_ID,
            title: LESSON_TITLE,
            order: 1,
            durationMinutes: 12,
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

async function setupSavedMocks(
  page: Page,
  options: {
    initialSavedCourseIds?: string[]
    initialSavedLessonIds?: string[]
  } = {}
) {
  await setupMemberConfigMocks(page)

  const savedCourseIds = new Set(options.initialSavedCourseIds || [])
  const savedLessonIds = new Set(options.initialSavedLessonIds || [])

  await page.route('**/api/academy/courses', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildCourseCatalogResponse()),
    })
  })

  await page.route(`**/api/academy/lessons/${LESSON_ID}`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildLessonPayload()),
    })
  })

  await page.route(`**/api/academy/lessons/${LESSON_ID}/progress`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { lesson_id: LESSON_ID, action: 'view', xp_awarded: 0 },
      }),
    })
  })

  await page.route(`**/api/academy/lessons/${LESSON_ID}/quiz`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  })

  await page.route('**/api/academy/saved', async (route: Route) => {
    const method = route.request().method()

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildSavedItemsResponse(savedCourseIds, savedLessonIds)),
      })
      return
    }

    if (method === 'POST') {
      const body = route.request().postDataJSON() as { entity_type?: string; entity_id?: string } | null
      const entityType = body?.entity_type
      const entityId = body?.entity_id || ''

      let saved = false
      if (entityType === 'course') {
        if (savedCourseIds.has(entityId)) {
          savedCourseIds.delete(entityId)
          saved = false
        } else {
          savedCourseIds.add(entityId)
          saved = true
        }
      } else if (entityType === 'lesson') {
        if (savedLessonIds.has(entityId)) {
          savedLessonIds.delete(entityId)
          saved = false
        } else {
          savedLessonIds.add(entityId)
          saved = true
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { saved },
        }),
      })
      return
    }

    await route.continue()
  })
}

test.describe('Academy saved items', () => {
  test('saving a course adds it to the saved page', async ({ page }) => {
    await setupSavedMocks(page)

    await page.goto('/members/academy/courses')
    await page.getByRole('button', { name: 'Save course' }).click()
    await expect(page.getByRole('button', { name: 'Unsave course' })).toBeVisible()

    await page.goto('/members/academy/saved')
    await expect(page.getByRole('link', { name: COURSE_TITLE })).toBeVisible()
  })

  test('unsaving a course removes it from the saved page', async ({ page }) => {
    await setupSavedMocks(page, { initialSavedCourseIds: [COURSE_ID] })

    await page.goto('/members/academy/saved')
    await expect(page.getByRole('link', { name: COURSE_TITLE })).toBeVisible()

    await page.getByRole('button', { name: 'Unsave' }).first().click()
    await expect(page.getByRole('link', { name: COURSE_TITLE })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible()
  })

  test('saving a lesson appears in saved lessons', async ({ page }) => {
    await setupSavedMocks(page)

    await page.goto(`/members/academy/learn/${LESSON_ID}`)
    await page.getByRole('button', { name: 'Save Lesson' }).click()
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible()

    await page.goto('/members/academy/saved')
    await expect(page.getByRole('link', { name: LESSON_TITLE })).toBeVisible()
  })

  test('shows empty state when nothing is saved', async ({ page }) => {
    await setupSavedMocks(page)

    await page.goto('/members/academy/saved')

    await expect(page.getByRole('heading', { name: 'Nothing saved yet' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Explore Courses' })).toHaveAttribute(
      'href',
      '/members/academy/courses'
    )
  })
})
