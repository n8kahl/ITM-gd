import type { Page, Route } from '@playwright/test'

const PROGRAM_ID = '00000000-0000-4000-8000-000000000001'
const TRACK_ID = '00000000-0000-4000-8000-000000000010'

const MODULE_A_ID = '00000000-0000-4000-8000-000000000101'
const MODULE_B_ID = '00000000-0000-4000-8000-000000000102'

const LESSON_A1_ID = '11111111-1111-4111-8111-111111111111'
const LESSON_A2_ID = '11111111-1111-4111-8111-222222222222'
const LESSON_B1_ID = '11111111-1111-4111-8111-333333333333'

const BLOCK_A1_1_ID = '44444444-4444-4444-8444-111111111111'
const BLOCK_A1_2_ID = '44444444-4444-4444-8444-222222222222'
const BLOCK_B1_1_ID = '44444444-4444-4444-8444-333333333333'

const COMP_A_ID = '22222222-2222-4222-8222-111111111111'
const COMP_B_ID = '22222222-2222-4222-8222-222222222222'

const QUEUE_A_ID = '33333333-3333-4333-8333-111111111111'
const QUEUE_B_ID = '33333333-3333-4333-8333-222222222222'

export const ACADEMY_V3_FIXTURES = {
  moduleSlugs: {
    setupRisk: 'setup-risk-framework',
    execution: 'execution-and-management',
  },
  moduleTitles: {
    setupRisk: 'Setup and Risk Framework',
    execution: 'Execution and Management',
  },
  lessonIds: {
    setupRiskOne: LESSON_A1_ID,
    executionOne: LESSON_B1_ID,
  },
}

function buildPlanPayload() {
  return {
    data: {
      program: {
        id: PROGRAM_ID,
        code: 'FOUNDATIONS',
        title: 'TITM Foundations Program',
        description: 'Structured competency-based core training.',
        isActive: true,
        createdAt: '2026-02-10T12:00:00.000Z',
        updatedAt: '2026-02-10T12:00:00.000Z',
      },
      tracks: [
        {
          id: TRACK_ID,
          programId: PROGRAM_ID,
          code: 'CORE',
          title: 'Core Execution',
          description: 'Risk-first execution and management.',
          position: 0,
          isActive: true,
          modules: [
            {
              id: MODULE_A_ID,
              trackId: TRACK_ID,
              slug: ACADEMY_V3_FIXTURES.moduleSlugs.setupRisk,
              code: 'M-SETUP-RISK',
              title: ACADEMY_V3_FIXTURES.moduleTitles.setupRisk,
              description: 'Build repeatable setup criteria and risk structure.',
              coverImageUrl: '/academy/illustrations/risk-sizing.svg',
              learningOutcomes: ['Define checklist before entry', 'Size risk consistently'],
              estimatedMinutes: 40,
              position: 0,
              isPublished: true,
              lessons: [
                {
                  id: LESSON_A1_ID,
                  moduleId: MODULE_A_ID,
                  slug: 'define-risk-before-entry',
                  title: 'Define Risk Before Entry',
                  learningObjective: 'Map invalidation and stop before execution.',
                  heroImageUrl: '/academy/illustrations/entry-validation.svg',
                  estimatedMinutes: 12,
                  difficulty: 'beginner',
                  prerequisiteLessonIds: [],
                  position: 0,
                  isPublished: true,
                },
                {
                  id: LESSON_A2_ID,
                  moduleId: MODULE_A_ID,
                  slug: 'position-size-discipline',
                  title: 'Position Size Discipline',
                  learningObjective: 'Apply fixed-risk sizing process.',
                  heroImageUrl: '/academy/illustrations/risk-sizing.svg',
                  estimatedMinutes: 14,
                  difficulty: 'beginner',
                  prerequisiteLessonIds: [LESSON_A1_ID],
                  position: 1,
                  isPublished: true,
                },
              ],
            },
            {
              id: MODULE_B_ID,
              trackId: TRACK_ID,
              slug: ACADEMY_V3_FIXTURES.moduleSlugs.execution,
              code: 'M-EXEC-MGMT',
              title: ACADEMY_V3_FIXTURES.moduleTitles.execution,
              description: 'Improve in-trade decisions and exits.',
              coverImageUrl: '/academy/illustrations/trade-management.svg',
              learningOutcomes: ['Manage winners systematically', 'Avoid emotional exits'],
              estimatedMinutes: 35,
              position: 1,
              isPublished: true,
              lessons: [
                {
                  id: LESSON_B1_ID,
                  moduleId: MODULE_B_ID,
                  slug: 'execution-drill-1',
                  title: 'Execution Drill 1',
                  learningObjective: 'Practice execution sequencing under pressure.',
                  heroImageUrl: '/academy/illustrations/market-context.svg',
                  estimatedMinutes: 11,
                  difficulty: 'intermediate',
                  prerequisiteLessonIds: [LESSON_A2_ID],
                  position: 0,
                  isPublished: true,
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

function buildModulePayload(slug: string) {
  const plan = buildPlanPayload().data
  const moduleRecord = plan.tracks.flatMap((track) => track.modules).find((moduleItem) => moduleItem.slug === slug)
  if (!moduleRecord) return null
  return { data: moduleRecord }
}

function buildLessonPayload(lessonId: string) {
  const lessons = buildPlanPayload().data.tracks.flatMap((track) =>
    track.modules.flatMap((moduleItem) => moduleItem.lessons)
  )
  const lessonRecord = lessons.find((lesson) => lesson.id === lessonId)
  if (!lessonRecord) return null

  const blocksByLesson: Record<string, Array<{ id: string; blockType: string; position: number; title: string | null; contentJson: Record<string, unknown> }>> = {
    [LESSON_A1_ID]: [
      {
        id: BLOCK_A1_1_ID,
        blockType: 'hook',
        position: 0,
        title: 'Risk Starts Before Entry',
        contentJson: {
          markdown: 'Define invalidation first, then position size.',
          imageUrl: '/academy/illustrations/entry-validation.svg',
        },
      },
      {
        id: BLOCK_A1_2_ID,
        blockType: 'guided_practice',
        position: 1,
        title: 'Map Invalidation',
        contentJson: {
          markdown: 'Practice selecting one invalidation level for each setup.',
          imageUrl: '/academy/illustrations/risk-sizing.svg',
        },
      },
    ],
    [LESSON_B1_ID]: [
      {
        id: BLOCK_B1_1_ID,
        blockType: 'worked_example',
        position: 0,
        title: 'Execution Sequence',
        contentJson: {
          markdown: 'Follow the sequence: setup, trigger, manage, exit.',
          imageUrl: '/academy/illustrations/trade-management.svg',
        },
      },
    ],
  }

  const blocks = (blocksByLesson[lessonId] || []).map((block) => ({
    id: block.id,
    lessonId,
    blockType: block.blockType,
    position: block.position,
    title: block.title,
    contentJson: block.contentJson,
  }))

  return {
    data: {
      ...lessonRecord,
      blocks,
    },
  }
}

function buildMasteryPayload() {
  return {
    data: {
      items: [
        {
          competencyId: COMP_A_ID,
          competencyKey: 'risk_definition',
          competencyTitle: 'Risk Definition',
          currentScore: 78,
          confidence: 0.72,
          needsRemediation: false,
          lastEvaluatedAt: '2026-02-14T15:00:00.000Z',
        },
        {
          competencyId: COMP_B_ID,
          competencyKey: 'execution_discipline',
          competencyTitle: 'Execution Discipline',
          currentScore: 62,
          confidence: 0.61,
          needsRemediation: true,
          lastEvaluatedAt: '2026-02-14T15:00:00.000Z',
        },
      ],
    },
  }
}

function buildRecommendationsPayload() {
  return {
    data: {
      items: [
        {
          type: 'review',
          title: 'Clear your review queue',
          reason: '2 review items are due now.',
          actionLabel: 'Start review',
          actionTarget: '/members/academy/review',
        },
        {
          type: 'lesson',
          title: 'Execution Drill 1',
          reason: 'Targets execution discipline improvement.',
          actionLabel: 'Open lesson',
          actionTarget: `/members/academy/lessons/${LESSON_B1_ID}`,
        },
      ],
    },
  }
}

function buildResumePayload() {
  return {
    data: {
      lessonId: LESSON_B1_ID,
      lessonTitle: 'Execution Drill 1',
      lessonNumber: 1,
      totalLessons: 1,
      completedLessons: 0,
      courseProgressPercent: 0,
      courseId: MODULE_B_ID,
      courseSlug: ACADEMY_V3_FIXTURES.moduleSlugs.execution,
      courseTitle: ACADEMY_V3_FIXTURES.moduleTitles.execution,
      resumeUrl: `/members/academy/lessons/${LESSON_B1_ID}`,
      courseUrl: `/members/academy/modules/${ACADEMY_V3_FIXTURES.moduleSlugs.execution}`,
      source: 'in_progress',
      source_reason: 'last_in_progress',
    },
  }
}

function buildProgressSummaryPayload() {
  return {
    data: {
      totalLessons: 3,
      completedLessons: 1,
      inProgressLessons: 1,
      progressPercent: 33,
      tracks: [
        {
          trackId: TRACK_ID,
          trackTitle: 'Core Execution',
          totalLessons: 3,
          completedLessons: 1,
          inProgressLessons: 1,
          progressPercent: 33,
        },
      ],
      modules: [
        {
          moduleId: MODULE_A_ID,
          moduleSlug: ACADEMY_V3_FIXTURES.moduleSlugs.setupRisk,
          moduleTitle: ACADEMY_V3_FIXTURES.moduleTitles.setupRisk,
          trackId: TRACK_ID,
          totalLessons: 2,
          completedLessons: 1,
          inProgressLessons: 0,
          progressPercent: 50,
        },
        {
          moduleId: MODULE_B_ID,
          moduleSlug: ACADEMY_V3_FIXTURES.moduleSlugs.execution,
          moduleTitle: ACADEMY_V3_FIXTURES.moduleTitles.execution,
          trackId: TRACK_ID,
          totalLessons: 1,
          completedLessons: 0,
          inProgressLessons: 1,
          progressPercent: 0,
        },
      ],
    },
  }
}

function buildModuleProgressPayload(slug: string) {
  if (slug === ACADEMY_V3_FIXTURES.moduleSlugs.setupRisk) {
    return {
      data: {
        moduleId: MODULE_A_ID,
        moduleSlug: slug,
        lessons: [
          {
            lessonId: LESSON_A1_ID,
            status: 'passed',
            progressPercent: 100,
            completedBlockIds: [BLOCK_A1_1_ID, BLOCK_A1_2_ID],
          },
          {
            lessonId: LESSON_A2_ID,
            status: 'not_started',
            progressPercent: 0,
            completedBlockIds: [],
          },
        ],
      },
    }
  }

  if (slug === ACADEMY_V3_FIXTURES.moduleSlugs.execution) {
    return {
      data: {
        moduleId: MODULE_B_ID,
        moduleSlug: slug,
        lessons: [
          {
            lessonId: LESSON_B1_ID,
            status: 'in_progress',
            progressPercent: 50,
            completedBlockIds: [],
          },
        ],
      },
    }
  }

  return null
}

function buildLessonAttemptPayload(lessonId: string) {
  if (lessonId === LESSON_B1_ID) {
    return {
      data: {
        lessonId,
        status: 'in_progress',
        progressPercent: 50,
        completedBlockIds: [],
      },
    }
  }

  return {
    data: {
      lessonId,
      status: 'not_started',
      progressPercent: 0,
      completedBlockIds: [],
    },
  }
}

function buildReviewItems(count: number) {
  const baseItems = [
    {
      queueId: QUEUE_A_ID,
      competencyId: COMP_A_ID,
      prompt: { prompt: 'What must be defined before entry?' },
      dueAt: '2026-02-16T14:00:00.000Z',
      intervalDays: 2,
      priorityWeight: 1.1,
    },
    {
      queueId: QUEUE_B_ID,
      competencyId: COMP_B_ID,
      prompt: { prompt: 'Which behavior reduces execution drift?' },
      dueAt: '2026-02-16T15:00:00.000Z',
      intervalDays: 3,
      priorityWeight: 1.3,
    },
  ]

  return baseItems.slice(0, Math.max(0, Math.min(baseItems.length, count)))
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

export async function setupAcademyV3Mocks(page: Page, options?: { reviewItemCount?: number }) {
  const reviewItemCount = options?.reviewItemCount ?? 2
  let reviewItems = buildReviewItems(reviewItemCount)

  await page.route('**/api/config/roles', async (route: Route) => {
    await fulfillJson(route, {
      'e2e-role-core': 'core',
      'e2e-role-pro': 'pro',
    })
  })

  await page.route('**/api/config/tabs', async (route: Route) => {
    await fulfillJson(route, {
      success: true,
      data: [
        { tab_id: 'dashboard', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 1, label: 'Dashboard', icon: 'layout-dashboard', path: '/members' },
        { tab_id: 'journal', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 2, label: 'Journal', icon: 'book-open', path: '/members/journal' },
        { tab_id: 'library', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 3, label: 'Academy', icon: 'graduation-cap', path: '/members/academy' },
      ],
    })
  })

  await page.route('**/api/academy-v3/plan**', async (route: Route) => {
    await fulfillJson(route, buildPlanPayload())
  })

  await page.route('**/api/academy-v3/modules/*', async (route: Route) => {
    const slug = route.request().url().split('/').pop() || ''
    const payload = buildModulePayload(decodeURIComponent(slug))
    if (!payload) {
      await fulfillJson(route, { error: { code: 'NOT_FOUND', message: 'Module not found' } }, 404)
      return
    }

    await fulfillJson(route, payload)
  })

  await page.route('**/api/academy-v3/modules/*/progress', async (route: Route) => {
    const parts = route.request().url().split('/')
    const slug = decodeURIComponent(parts[parts.length - 2] || '')
    const payload = buildModuleProgressPayload(slug)

    if (!payload) {
      await fulfillJson(route, { error: { code: 'NOT_FOUND', message: 'Module not found' } }, 404)
      return
    }

    await fulfillJson(route, payload)
  })

  await page.route('**/api/academy-v3/lessons/*', async (route: Route) => {
    const lessonId = route.request().url().split('/').pop() || ''
    const payload = buildLessonPayload(decodeURIComponent(lessonId))
    if (!payload) {
      await fulfillJson(route, { error: { code: 'NOT_FOUND', message: 'Lesson not found' } }, 404)
      return
    }

    await fulfillJson(route, payload)
  })

  await page.route('**/api/academy-v3/lessons/*/attempt', async (route: Route) => {
    const parts = route.request().url().split('/')
    const lessonId = decodeURIComponent(parts[parts.length - 2] || '')
    await fulfillJson(route, buildLessonAttemptPayload(lessonId))
  })

  await page.route('**/api/academy-v3/lessons/*/start', async (route: Route) => {
    await fulfillJson(route, {
      data: {
        lessonAttemptId: '55555555-5555-4555-8555-111111111111',
        status: 'in_progress',
      },
    })
  })

  await page.route('**/api/academy-v3/lessons/*/complete-block', async (route: Route) => {
    await fulfillJson(route, {
      data: {
        progressPercent: 100,
        nextBlockId: null,
        status: 'passed',
      },
    })
  })

  await page.route('**/api/academy-v3/mastery**', async (route: Route) => {
    await fulfillJson(route, buildMasteryPayload())
  })

  await page.route('**/api/academy-v3/recommendations**', async (route: Route) => {
    await fulfillJson(route, buildRecommendationsPayload())
  })

  await page.route('**/api/academy-v3/resume**', async (route: Route) => {
    await fulfillJson(route, buildResumePayload())
  })

  await page.route('**/api/academy-v3/progress-summary**', async (route: Route) => {
    await fulfillJson(route, buildProgressSummaryPayload())
  })

  await page.route('**/api/academy-v3/review**', async (route: Route) => {
    await fulfillJson(route, {
      data: {
        dueCount: reviewItems.length,
        items: reviewItems,
      },
    })
  })

  await page.route('**/api/academy-v3/review/*/submit', async (route: Route) => {
    const queueId = route.request().url().split('/').slice(-2)[0]
    reviewItems = reviewItems.filter((item) => item.queueId !== queueId)

    await fulfillJson(route, {
      data: {
        queueId,
        isCorrect: true,
        nextDueAt: '2026-02-18T16:00:00.000Z',
        intervalDays: 2,
      },
    })
  })
}
