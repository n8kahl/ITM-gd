'use client'

import {
  academyErrorResponseSchema,
  getAcademyPlanResponseSchema,
  getAcademyModuleResponseSchema,
  getAcademyLessonResponseSchema,
  getReviewQueueResponseSchema,
  getMasteryResponseSchema,
  getRecommendationsResponseSchema,
  getAcademyResumeResponseSchema,
  getAcademyModuleProgressResponseSchema,
  getAcademyLessonAttemptResponseSchema,
  getAcademyProgressSummaryResponseSchema,
  submitReviewResponseSchema,
  startLessonResponseSchema,
  completeBlockResponseSchema,
  submitAssessmentResponseSchema,
  type StartLessonRequest,
  type CompleteBlockRequest,
  type SubmitAssessmentRequest,
  type SubmitReviewRequest,
} from '@/lib/academy-v3/contracts/api'

async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  parse: (value: unknown) => T
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const parsedError = academyErrorResponseSchema.safeParse(payload)
    if (parsedError.success) {
      throw new Error(parsedError.data.error.message)
    }

    throw new Error('Request failed')
  }

  return parse(payload)
}

export async function fetchAcademyPlan(programCode?: string) {
  const url = programCode
    ? `/api/academy-v3/plan?program=${encodeURIComponent(programCode)}`
    : '/api/academy-v3/plan'

  return fetchJson(url, undefined, (value) => getAcademyPlanResponseSchema.parse(value).data)
}

export async function fetchAcademyModule(slug: string) {
  return fetchJson(`/api/academy-v3/modules/${encodeURIComponent(slug)}`, undefined, (value) =>
    getAcademyModuleResponseSchema.parse(value).data
  )
}

export async function fetchAcademyLesson(lessonId: string) {
  return fetchJson(`/api/academy-v3/lessons/${encodeURIComponent(lessonId)}`, undefined, (value) =>
    getAcademyLessonResponseSchema.parse(value).data
  )
}

export async function fetchReviewQueue(limit = 20) {
  return fetchJson(`/api/academy-v3/review?limit=${limit}`, undefined, (value) =>
    getReviewQueueResponseSchema.parse(value).data
  )
}

export async function submitReview(queueId: string, body: SubmitReviewRequest) {
  return fetchJson(
    `/api/academy-v3/review/${encodeURIComponent(queueId)}/submit`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    (value) => submitReviewResponseSchema.parse(value).data
  )
}

export async function fetchMastery() {
  return fetchJson('/api/academy-v3/mastery', undefined, (value) =>
    getMasteryResponseSchema.parse(value).data
  )
}

export async function fetchRecommendations() {
  return fetchJson('/api/academy-v3/recommendations', undefined, (value) =>
    getRecommendationsResponseSchema.parse(value).data
  )
}

export async function fetchAcademyResume() {
  return fetchJson('/api/academy-v3/resume', undefined, (value) =>
    getAcademyResumeResponseSchema.parse(value).data
  )
}

export async function fetchAcademyModuleProgress(slug: string) {
  return fetchJson(`/api/academy-v3/modules/${encodeURIComponent(slug)}/progress`, undefined, (value) =>
    getAcademyModuleProgressResponseSchema.parse(value).data
  )
}

export async function fetchAcademyLessonAttempt(lessonId: string) {
  return fetchJson(`/api/academy-v3/lessons/${encodeURIComponent(lessonId)}/attempt`, undefined, (value) =>
    getAcademyLessonAttemptResponseSchema.parse(value).data
  )
}

export async function fetchAcademyProgressSummary() {
  return fetchJson('/api/academy-v3/progress-summary', undefined, (value) =>
    getAcademyProgressSummaryResponseSchema.parse(value).data
  )
}

export async function startLesson(lessonId: string, body: StartLessonRequest) {
  return fetchJson(
    `/api/academy-v3/lessons/${encodeURIComponent(lessonId)}/start`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    (value) => startLessonResponseSchema.parse(value).data
  )
}

export async function completeLessonBlock(lessonId: string, body: CompleteBlockRequest) {
  return fetchJson(
    `/api/academy-v3/lessons/${encodeURIComponent(lessonId)}/complete-block`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    (value) => completeBlockResponseSchema.parse(value).data
  )
}

export async function submitAssessment(assessmentId: string, body: SubmitAssessmentRequest) {
  return fetchJson(
    `/api/academy-v3/assessments/${encodeURIComponent(assessmentId)}/submit`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    (value) => submitAssessmentResponseSchema.parse(value).data
  )
}
