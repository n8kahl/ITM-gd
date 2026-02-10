import { test, expect, type Page, type Route } from '@playwright/test'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

const COURSE_SLUG = 'options-basics'
const LESSON_IDS = ['lesson-1', 'lesson-2', 'lesson-3'] as const

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

function buildCourseLessonState(completedLessonIds: Set<string>) {
  return LESSON_IDS.map((lessonId, index) => {
    const previousLessonId = LESSON_IDS[index - 1]
    const isCompleted = completedLessonIds.has(lessonId)
    const isLocked = !isCompleted && !!previousLessonId && !completedLessonIds.has(previousLessonId)

    return {
      id: lessonId,
      title:
        lessonId === 'lesson-1'
          ? 'Delta Foundations'
          : lessonId === 'lesson-2'
            ? 'Delta in Practice for Scalpers'
            : 'Gamma Discipline',
      order: index + 1,
      durationMinutes: 8 + index,
      isCompleted,
      isLocked,
    }
  })
}

function buildLessonPayload(lessonId: string, completedLessonIds: Set<string>) {
  const lessonTitle =
    lessonId === 'lesson-1'
      ? 'Delta Foundations'
      : lessonId === 'lesson-2'
        ? 'Delta in Practice for Scalpers'
        : 'Gamma Discipline'

  return {
    success: true,
    data: {
      id: lessonId,
      title: lessonTitle,
      content: `## ${lessonTitle}\n\nThis lesson explains the concept in practical, trade-ready language.\n\nUse this section to validate the action rail is attached to content and not lost in whitespace.`,
      contentType: 'markdown',
      videoUrl: null,
      durationMinutes: 9,
      order: LESSON_IDS.indexOf(lessonId as (typeof LESSON_IDS)[number]) + 1,
      isCompleted: completedLessonIds.has(lessonId),
      course: {
        slug: COURSE_SLUG,
        title: 'Options Basics',
        lessons: buildCourseLessonState(completedLessonIds),
      },
      quiz: null,
    },
  }
}

async function setupLessonMocks(page: Page) {
  const completedLessonIds = new Set<string>(['lesson-1'])

  await page.route('**/api/academy/lessons/**', async (route: Route) => {
    const request = route.request()
    const method = request.method()
    const pathname = new URL(request.url()).pathname

    if (method === 'POST' && pathname.endsWith('/progress')) {
      const body = request.postDataJSON() as { action?: string } | null
      const lessonId = pathname.split('/').slice(-2)[0]
      if (body?.action === 'complete' && lessonId) {
        completedLessonIds.add(lessonId)
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            lesson_id: lessonId,
            action: body?.action || 'view',
            xp_awarded: body?.action === 'complete' ? 10 : 0,
          },
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
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildLessonPayload(lessonId, completedLessonIds)),
      })
      return
    }

    await route.continue()
  })
}

async function setupCourseDetailMocks(page: Page) {
  await page.route(`**/api/academy/courses/${COURSE_SLUG}`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          slug: COURSE_SLUG,
          title: 'Options Basics',
          description: 'Master options mechanics.',
          longDescription: 'A focused curriculum on single-leg options execution.',
          thumbnailUrl: null,
          difficulty: 'beginner',
          path: 'Options',
          estimatedMinutes: 45,
          lessons: [
            {
              id: 'lesson-1',
              title: 'Delta Foundations',
              order: 1,
              durationMinutes: 10,
              contentType: 'markdown',
              isCompleted: true,
              isLocked: false,
            },
            {
              id: 'lesson-2',
              title: 'Delta in Practice for Scalpers',
              order: 2,
              durationMinutes: 15,
              contentType: 'markdown',
              isCompleted: true,
              isLocked: false,
            },
          ],
          totalLessons: 2,
          completedLessons: 2,
          objectives: ['Understand delta'],
          prerequisites: [],
        },
      }),
    })
  })
}

async function setupCourseCatalogMocks(page: Page) {
  await page.route('**/api/academy/courses', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          courses: [],
          paths: ['Options'],
        },
      }),
    })
  })
}

async function setupAcademyNavSurfaceMocks(page: Page) {
  await setupMemberConfigMocks(page)

  await page.route('**/api/academy/onboarding-status', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { completed: true },
      }),
    })
  })

  await page.route('**/api/academy/dashboard', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          stats: {
            coursesCompleted: 1,
            totalCourses: 9,
            lessonsCompleted: 4,
            totalLessons: 53,
            quizzesPassed: 2,
            currentXp: 125,
            currentStreak: 3,
            activeDays: ['2026-02-10'],
          },
          currentLesson: null,
          resumeInsight: null,
          recommendedCourses: [],
          recentAchievements: [],
        },
      }),
    })
  })

  await page.route('**/api/academy/resume', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          target: null,
        },
      }),
    })
  })

  await page.route('**/api/academy/review*', async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (pathname === '/api/academy/review' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [],
            stats: {
              total_due: 0,
              estimated_minutes: 0,
              weak_competencies: [],
            },
          },
        }),
      })
      return
    }

    await route.continue()
  })

  await page.route('**/api/academy/saved', async (route: Route) => {
    const method = route.request().method()

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [],
          },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { saved: true },
      }),
    })
  })

  await setupCourseCatalogMocks(page)
}

test.describe('Academy lesson layout and navigation', () => {
  test('keeps completion actions visible and navigates to the next lesson', async ({ page }) => {
    await setupMemberConfigMocks(page)
    await setupLessonMocks(page)

    await page.goto('/members/academy/learn/lesson-2')

    await expect(page.getByTestId('lesson-actions')).toBeVisible()
    await expect(page.getByTestId('lesson-primary-action')).toHaveText(/Complete & Next Lesson/i)
    await expect(page.getByRole('main').getByRole('link', { name: 'Explore', exact: true })).toHaveAttribute('aria-current', 'page')

    const articleBox = await page.locator('article').first().boundingBox()
    const actionBox = await page.getByTestId('lesson-actions').boundingBox()
    expect(articleBox).not.toBeNull()
    expect(actionBox).not.toBeNull()
    if (articleBox && actionBox) {
      const whitespaceGap = actionBox.y - (articleBox.y + articleBox.height)
      expect(whitespaceGap).toBeLessThan(140)
    }

    await page.getByTestId('lesson-primary-action').click()
    await page.waitForURL('**/members/academy/learn/lesson-3')
    await expect(page.getByRole('heading', { name: 'Gamma Discipline', level: 1 })).toBeVisible()
  })

  test('shows course-complete CTA when all lessons are complete', async ({ page }) => {
    await setupMemberConfigMocks(page)
    await setupCourseDetailMocks(page)

    await page.goto(`/members/academy/courses/${COURSE_SLUG}`)

    const courseCompleteButton = page.getByRole('link', { name: /Course Complete/i })
    await expect(courseCompleteButton).toBeVisible()
    await expect(courseCompleteButton).toHaveAttribute('href', '/members/academy/review')
  })

  test('keeps lesson actions reachable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupMemberConfigMocks(page)
    await setupLessonMocks(page)

    await page.goto('/members/academy/learn/lesson-2')

    await expect(page.getByLabel('Toggle lesson sidebar')).toBeVisible()
    const primaryAction = page.getByTestId('lesson-primary-action')
    await expect(primaryAction).toBeVisible()

    const actionBox = await primaryAction.boundingBox()
    expect(actionBox).not.toBeNull()
    if (actionBox) {
      expect(actionBox.y).toBeLessThan(820)
    }

    await primaryAction.click()
    await page.waitForURL('**/members/academy/learn/lesson-3')
  })

  test('keeps sidebar completion button fully visible on desktop lesson layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await setupMemberConfigMocks(page)
    await setupLessonMocks(page)

    await page.goto('/members/academy/learn/lesson-2')

    const sidebarCompleteButton = page.getByTestId('sidebar-mark-complete')
    await expect(sidebarCompleteButton).toBeVisible()

    const buttonBox = await sidebarCompleteButton.boundingBox()
    const viewport = page.viewportSize()
    expect(buttonBox).not.toBeNull()
    if (buttonBox && viewport) {
      expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(viewport.height + 24)
    }
  })

  test('shows all five academy tabs and keeps active state across routes', async ({ page }) => {
    await setupAcademyNavSurfaceMocks(page)

    await page.goto('/members/academy')

    const homeLink = page.getByRole('main').getByRole('link', { name: 'Home', exact: true })
    const exploreLink = page.getByRole('main').getByRole('link', { name: 'Explore', exact: true })
    const continueLink = page.getByRole('main').getByRole('link', { name: 'Continue', exact: true })
    const reviewLink = page.getByRole('main').getByRole('link', { name: 'Review', exact: true })
    const savedLink = page.getByRole('main').getByRole('link', { name: 'Saved', exact: true })

    await expect(homeLink).toBeVisible()
    await expect(exploreLink).toBeVisible()
    await expect(continueLink).toBeVisible()
    await expect(reviewLink).toBeVisible()
    await expect(savedLink).toBeVisible()
    await expect(homeLink).toHaveAttribute('aria-current', 'page')

    await exploreLink.click()
    await expect(page).toHaveURL(/\/members\/academy\/courses$/)
    await expect(page.getByRole('main').getByRole('link', { name: 'Explore', exact: true })).toHaveAttribute('aria-current', 'page')

    await page.getByRole('main').getByRole('link', { name: 'Continue', exact: true }).click()
    await expect(page).toHaveURL(/\/members\/academy\/continue$/)
    await expect(page.getByRole('main').getByRole('link', { name: 'Continue', exact: true })).toHaveAttribute('aria-current', 'page')

    await page.getByRole('main').getByRole('link', { name: 'Review', exact: true }).click()
    await expect(page).toHaveURL(/\/members\/academy\/review$/)
    await expect(page.getByRole('main').getByRole('link', { name: 'Review', exact: true })).toHaveAttribute('aria-current', 'page')

    await page.getByRole('main').getByRole('link', { name: 'Saved', exact: true }).click()
    await expect(page).toHaveURL(/\/members\/academy\/saved$/)
    await expect(page.getByRole('main').getByRole('link', { name: 'Saved', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('mobile bottom nav highlights Library when browsing academy', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupAcademyNavSurfaceMocks(page)

    await page.goto('/members/academy/courses')
    await expect(page.getByRole('link', { name: 'Library', exact: true })).toHaveAttribute('aria-current', 'page')

    await page.goto('/members/academy/review')
    await expect(page.getByRole('link', { name: 'Library', exact: true })).toHaveAttribute('aria-current', 'page')
  })
})
