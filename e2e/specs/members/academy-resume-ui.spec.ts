import { test, expect, type Route } from '@playwright/test'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

test.describe('Academy resume UI integration', () => {
  test('Continue page surfaces canonical resume target from /api/academy/resume', async ({ page }) => {
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

    await page.route('**/api/academy/resume', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            target: {
              lessonId: 'resume-lesson',
              lessonTitle: 'Gamma Traps in Fast Markets',
              lessonNumber: 3,
              totalLessons: 9,
              courseProgressPercent: 44,
              courseSlug: 'options-basics',
              courseTitle: 'Options Basics',
              resumeUrl: '/members/academy/learn/resume-lesson',
            },
          },
        }),
      })
    })

    await page.goto('/members/academy/continue')

    await expect(page.getByText('Next Up')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Gamma Traps in Fast Markets' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Resume Next Lesson' })).toHaveAttribute(
      'href',
      '/members/academy/learn/resume-lesson'
    )
  })

  test('Course detail continue CTA honors resumeLessonId from API payload', async ({ page }) => {
    await page.route('**/api/academy/courses/options-basics', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            slug: 'options-basics',
            title: 'Options Basics',
            description: 'Learn options mechanics.',
            longDescription: 'Learn options mechanics.',
            thumbnailUrl: null,
            difficulty: 'beginner',
            path: 'Options',
            estimatedMinutes: 55,
            lessons: [
              {
                id: 'lesson-1',
                title: 'Delta Basics',
                order: 1,
                durationMinutes: 12,
                contentType: 'markdown',
                isCompleted: false,
                isLocked: false,
              },
              {
                id: 'lesson-2',
                title: 'Gamma Exposure',
                order: 2,
                durationMinutes: 14,
                contentType: 'markdown',
                isCompleted: false,
                isLocked: true,
              },
              {
                id: 'lesson-3',
                title: 'Trade Management',
                order: 3,
                durationMinutes: 15,
                contentType: 'markdown',
                isCompleted: false,
                isLocked: true,
              },
            ],
            totalLessons: 3,
            completedLessons: 0,
            resumeLessonId: 'lesson-3',
            objectives: [],
            prerequisites: [],
          },
        }),
      })
    })

    await page.goto('/members/academy/courses/options-basics')

    const cta = page.getByRole('link', { name: 'Start Course' })
    await expect(cta).toHaveAttribute('href', '/members/academy/learn/lesson-3')
  })
})
