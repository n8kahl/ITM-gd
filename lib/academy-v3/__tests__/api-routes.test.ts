import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const LESSON_ID = '10000000-0000-4000-8000-000000000001'
const BLOCK_ID = '10000000-0000-4000-8000-000000000002'
const ASSESSMENT_ID = '20000000-0000-4000-8000-000000000001'
const QUEUE_ID = '30000000-0000-4000-8000-000000000001'

const {
  mockGetAuthenticatedUserFromRequest,
  mockGetPlan,
  mockGetModuleBySlug,
  mockGetLessonById,
  mockStartLesson,
  mockCompleteBlock,
  mockSubmitAssessment,
  mockGetDueQueue,
  mockSubmitReview,
  mockGetMastery,
  mockGetRecommendations,
  MockPlanNotFoundError,
  MockModuleNotFoundError,
  MockLessonNotFoundError,
  MockBlockNotFoundError,
  MockAssessmentNotFoundError,
  MockReviewQueueItemNotFoundError,
} = vi.hoisted(() => {
  class PlanNotFoundError extends Error {}
  class ModuleNotFoundError extends Error {}
  class LessonNotFoundError extends Error {}
  class BlockNotFoundError extends Error {}
  class AssessmentNotFoundError extends Error {}
  class ReviewQueueItemNotFoundError extends Error {}

  return {
    mockGetAuthenticatedUserFromRequest: vi.fn(),
    mockGetPlan: vi.fn(),
    mockGetModuleBySlug: vi.fn(),
    mockGetLessonById: vi.fn(),
    mockStartLesson: vi.fn(),
    mockCompleteBlock: vi.fn(),
    mockSubmitAssessment: vi.fn(),
    mockGetDueQueue: vi.fn(),
    mockSubmitReview: vi.fn(),
    mockGetMastery: vi.fn(),
    mockGetRecommendations: vi.fn(),
    MockPlanNotFoundError: PlanNotFoundError,
    MockModuleNotFoundError: ModuleNotFoundError,
    MockLessonNotFoundError: LessonNotFoundError,
    MockBlockNotFoundError: BlockNotFoundError,
    MockAssessmentNotFoundError: AssessmentNotFoundError,
    MockReviewQueueItemNotFoundError: ReviewQueueItemNotFoundError,
  }
})

vi.mock('@/lib/request-auth', () => ({
  getAuthenticatedUserFromRequest: (...args: unknown[]) =>
    mockGetAuthenticatedUserFromRequest(...args),
}))

vi.mock('@/lib/academy-v3/services', () => ({
  AcademyPlanService: class AcademyPlanService {
    async getPlan(...args: unknown[]) {
      return mockGetPlan(...args)
    }
  },
  AcademyModuleService: class AcademyModuleService {
    async getModuleBySlug(...args: unknown[]) {
      return mockGetModuleBySlug(...args)
    }
  },
  AcademyLessonService: class AcademyLessonService {
    async getLessonById(...args: unknown[]) {
      return mockGetLessonById(...args)
    }
  },
  AcademyProgressionService: class AcademyProgressionService {
    async startLesson(...args: unknown[]) {
      return mockStartLesson(...args)
    }

    async completeBlock(...args: unknown[]) {
      return mockCompleteBlock(...args)
    }
  },
  AcademyAssessmentService: class AcademyAssessmentService {
    async submitAssessment(...args: unknown[]) {
      return mockSubmitAssessment(...args)
    }
  },
  AcademyReviewService: class AcademyReviewService {
    async getDueQueue(...args: unknown[]) {
      return mockGetDueQueue(...args)
    }

    async submitReview(...args: unknown[]) {
      return mockSubmitReview(...args)
    }
  },
  AcademyMasteryService: class AcademyMasteryService {
    async getMastery(...args: unknown[]) {
      return mockGetMastery(...args)
    }
  },
  AcademyRecommendationService: class AcademyRecommendationService {
    async getRecommendations(...args: unknown[]) {
      return mockGetRecommendations(...args)
    }
  },
  AcademyPlanNotFoundError: MockPlanNotFoundError,
  AcademyModuleNotFoundError: MockModuleNotFoundError,
  AcademyLessonNotFoundError: MockLessonNotFoundError,
  AcademyBlockNotFoundError: MockBlockNotFoundError,
  AcademyAssessmentNotFoundError: MockAssessmentNotFoundError,
  AcademyReviewQueueItemNotFoundError: MockReviewQueueItemNotFoundError,
}))

import { GET as getPlanRoute } from '@/app/api/academy-v3/plan/route'
import { GET as getModuleRoute } from '@/app/api/academy-v3/modules/[slug]/route'
import { GET as getLessonRoute } from '@/app/api/academy-v3/lessons/[id]/route'
import { POST as startLessonRoute } from '@/app/api/academy-v3/lessons/[id]/start/route'
import { POST as completeBlockRoute } from '@/app/api/academy-v3/lessons/[id]/complete-block/route'
import { POST as submitAssessmentRoute } from '@/app/api/academy-v3/assessments/[id]/submit/route'
import { GET as getReviewRoute } from '@/app/api/academy-v3/review/route'
import { POST as submitReviewRoute } from '@/app/api/academy-v3/review/[queueId]/submit/route'
import { GET as getMasteryRoute } from '@/app/api/academy-v3/mastery/route'
import { GET as getRecommendationsRoute } from '@/app/api/academy-v3/recommendations/route'

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1]

function makeAuthedRequest(url: string, init?: NextRequestInit) {
  return new NextRequest(url, init)
}

beforeEach(() => {
  vi.clearAllMocks()

  mockGetAuthenticatedUserFromRequest.mockResolvedValue({
    user: { id: USER_ID },
    supabase: {},
  })
})

describe('academy-v3 api route contracts', () => {
  it('returns unauthorized envelope for plan route without auth', async () => {
    mockGetAuthenticatedUserFromRequest.mockResolvedValueOnce(null)

    const response = await getPlanRoute(makeAuthedRequest('http://localhost/api/academy-v3/plan'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns typed plan payload when authenticated', async () => {
    mockGetPlan.mockResolvedValueOnce({
      program: {
        id: '40000000-0000-4000-8000-000000000001',
        code: 'titm-core-program',
        title: 'Program',
        description: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      tracks: [],
    })

    const response = await getPlanRoute(
      makeAuthedRequest('http://localhost/api/academy-v3/plan?program=titm-core-program')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.program.code).toBe('titm-core-program')
    expect(mockGetPlan).toHaveBeenCalledWith({ programCode: 'titm-core-program' })
  })

  it('returns module not found envelope', async () => {
    mockGetModuleBySlug.mockRejectedValueOnce(new MockModuleNotFoundError('missing'))

    const response = await getModuleRoute(makeAuthedRequest('http://localhost/api/academy-v3/modules/m1'), {
      params: Promise.resolve({ slug: 'm1' }),
    })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error.code).toBe('MODULE_NOT_FOUND')
  })

  it('validates lesson id params', async () => {
    const response = await getLessonRoute(makeAuthedRequest('http://localhost/api/academy-v3/lessons/not-a-uuid'), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe('INVALID_PARAMS')
  })

  it('starts lesson with valid payload', async () => {
    mockStartLesson.mockResolvedValueOnce({
      lessonAttemptId: '50000000-0000-4000-8000-000000000001',
      status: 'in_progress',
    })

    const response = await startLessonRoute(
      makeAuthedRequest('http://localhost/api/academy-v3/lessons/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: 'plan' }),
      }),
      {
        params: Promise.resolve({ id: LESSON_ID }),
      }
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.status).toBe('in_progress')
    expect(mockStartLesson).toHaveBeenCalledWith({
      userId: USER_ID,
      lessonId: LESSON_ID,
      source: 'plan',
    })
  })

  it('returns block not found when completing invalid block', async () => {
    mockCompleteBlock.mockRejectedValueOnce(new MockBlockNotFoundError('missing block'))

    const response = await completeBlockRoute(
      makeAuthedRequest('http://localhost/api/academy-v3/lessons/complete-block', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ blockId: BLOCK_ID }),
      }),
      {
        params: Promise.resolve({ id: LESSON_ID }),
      }
    )
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error.code).toBe('BLOCK_NOT_FOUND')
  })

  it('submits assessment and returns remediation ids', async () => {
    mockSubmitAssessment.mockResolvedValueOnce({
      attemptId: '60000000-0000-4000-8000-000000000001',
      score: 0.62,
      passed: false,
      remediationCompetencyIds: ['70000000-0000-4000-8000-000000000001'],
    })

    const response = await submitAssessmentRoute(
      makeAuthedRequest('http://localhost/api/academy-v3/assessments/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: { q1: 'A' } }),
      }),
      {
        params: Promise.resolve({ id: ASSESSMENT_ID }),
      }
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.passed).toBe(false)
    expect(body.data.remediationCompetencyIds).toHaveLength(1)
  })

  it('gets and submits review queue items', async () => {
    mockGetDueQueue.mockResolvedValueOnce({
      dueCount: 1,
      items: [
        {
          queueId: QUEUE_ID,
          competencyId: '70000000-0000-4000-8000-000000000001',
          prompt: { prompt: 'Question' },
          dueAt: new Date().toISOString(),
          intervalDays: 1,
          priorityWeight: 1,
        },
      ],
    })

    const reviewResponse = await getReviewRoute(
      makeAuthedRequest('http://localhost/api/academy-v3/review?limit=10')
    )
    const reviewBody = await reviewResponse.json()

    expect(reviewResponse.status).toBe(200)
    expect(reviewBody.data.dueCount).toBe(1)

    mockSubmitReview.mockResolvedValueOnce({
      queueId: QUEUE_ID,
      isCorrect: true,
      nextDueAt: new Date(Date.now() + 86400000).toISOString(),
      intervalDays: 2,
    })

    const submitResponse = await submitReviewRoute(
      makeAuthedRequest('http://localhost/api/academy-v3/review/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answer: { selected: 'A' }, confidenceRating: 4 }),
      }),
      {
        params: Promise.resolve({ queueId: QUEUE_ID }),
      }
    )

    expect(submitResponse.status).toBe(200)
  })

  it('returns mastery and recommendation payloads', async () => {
    mockGetMastery.mockResolvedValueOnce({
      items: [
        {
          competencyId: '70000000-0000-4000-8000-000000000001',
          competencyKey: 'market_context',
          competencyTitle: 'Market Context',
          currentScore: 67,
          confidence: 0.6,
          needsRemediation: true,
          lastEvaluatedAt: null,
        },
      ],
    })

    mockGetRecommendations.mockResolvedValueOnce({
      items: [
        {
          type: 'review',
          title: 'Clear review queue',
          reason: '1 item due.',
          actionLabel: 'Start review',
          actionTarget: '/members/academy-v3/review',
        },
      ],
    })

    const masteryResponse = await getMasteryRoute(
      makeAuthedRequest('http://localhost/api/academy-v3/mastery')
    )
    const recommendationsResponse = await getRecommendationsRoute(
      makeAuthedRequest('http://localhost/api/academy-v3/recommendations')
    )

    expect(masteryResponse.status).toBe(200)
    expect(recommendationsResponse.status).toBe(200)
  })
})
