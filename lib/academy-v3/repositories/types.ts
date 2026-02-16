import type {
  AcademyLesson,
  AcademyLessonBlock,
  AcademyModule,
  AcademyProgram,
  AcademyTrack,
} from '../contracts/domain'

export interface AcademyLessonAttempt {
  id: string
  userId: string
  lessonId: string
  status: 'in_progress' | 'submitted' | 'passed' | 'failed'
  progressPercent: number
  metadata: Record<string, unknown>
}

export interface AcademyAssessment {
  id: string
  moduleId: string | null
  lessonId: string | null
  title: string
  assessmentType: 'diagnostic' | 'formative' | 'performance' | 'summative'
  masteryThreshold: number
  isPublished: boolean
}

export interface AcademyAssessmentItem {
  id: string
  assessmentId: string
  competencyId: string | null
  itemType:
    | 'single_select'
    | 'multi_select'
    | 'ordered_steps'
    | 'short_answer_rubric'
    | 'scenario_branch'
  prompt: string
  answerKeyJson: Record<string, unknown>
}

export interface AcademyMasteryRecord {
  competencyId: string
  competencyKey: string
  competencyTitle: string
  currentScore: number
  confidence: number
  needsRemediation: boolean
  lastEvaluatedAt: string | null
}

export interface AcademyReviewQueueRecord {
  queueId: string
  userId: string
  competencyId: string
  competencyKey: string | null
  competencyTitle: string | null
  promptJson: Record<string, unknown>
  dueAt: string
  intervalDays: number
  priorityWeight: number
}

export interface AcademyLessonRecommendation {
  lessonId: string
  lessonTitle: string
  moduleSlug: string
  moduleTitle: string
  competencyId: string
}

export interface AcademyProgramRepository {
  getActiveProgramByCode(code: string): Promise<AcademyProgram | null>
  listActivePrograms(): Promise<AcademyProgram[]>
}

export interface AcademyTrackRepository {
  listActiveTracksForProgram(programId: string): Promise<AcademyTrack[]>
}

export interface AcademyModuleRepository {
  getPublishedModuleBySlug(slug: string): Promise<AcademyModule | null>
  listPublishedModulesForTrack(trackId: string): Promise<AcademyModule[]>
}

export interface AcademyLessonRepository {
  getPublishedLessonById(lessonId: string): Promise<AcademyLesson | null>
  listPublishedLessonsForModule(moduleId: string): Promise<AcademyLesson[]>
  listBlocksForLesson(lessonId: string): Promise<AcademyLessonBlock[]>
  listRecommendedLessonsForCompetencies(
    competencyIds: string[],
    limit: number
  ): Promise<AcademyLessonRecommendation[]>
}

export interface AcademyProgressRepository {
  upsertLessonAttempt(input: {
    userId: string
    lessonId: string
    status: AcademyLessonAttempt['status']
    progressPercent: number
    metadata: Record<string, unknown>
  }): Promise<AcademyLessonAttempt>
  getLessonAttempt(userId: string, lessonId: string): Promise<AcademyLessonAttempt | null>
}

export interface AcademyAssessmentRepository {
  getPublishedAssessmentById(assessmentId: string): Promise<AcademyAssessment | null>
  listAssessmentItems(assessmentId: string): Promise<AcademyAssessmentItem[]>
  insertAssessmentAttempt(input: {
    userId: string
    assessmentId: string
    status: 'submitted' | 'passed' | 'failed'
    score: number
    competencyScoresJson: Record<string, unknown>
    answersJson: Record<string, unknown>
    feedbackJson: Record<string, unknown>
  }): Promise<{ id: string }>
}

export interface AcademyMasteryRepository {
  upsertMastery(input: {
    userId: string
    competencyId: string
    currentScore: number
    confidence: number
    needsRemediation: boolean
    metadata: Record<string, unknown>
  }): Promise<void>
  listMasteryForUser(userId: string): Promise<AcademyMasteryRecord[]>
}

export interface AcademyReviewRepository {
  listDueQueueItemsForUser(userId: string, limit: number): Promise<AcademyReviewQueueRecord[]>
  getQueueItemForUser(queueId: string, userId: string): Promise<AcademyReviewQueueRecord | null>
  insertQueueItem(input: {
    userId: string
    competencyId: string
    sourceAssessmentItemId: string | null
    promptJson: Record<string, unknown>
    dueAt: string
    intervalDays: number
    priorityWeight: number
    status: 'due' | 'completed' | 'snoozed' | 'skipped'
  }): Promise<void>
  updateQueueItem(input: {
    queueId: string
    userId: string
    dueAt: string
    intervalDays: number
    priorityWeight: number
    status: 'due' | 'completed' | 'snoozed' | 'skipped'
  }): Promise<void>
  insertReviewAttempt(input: {
    queueId: string
    userId: string
    answerJson: Record<string, unknown>
    isCorrect: boolean
    confidenceRating?: number
    latencyMs?: number
  }): Promise<void>
}

export interface AcademyLearningEventRepository {
  insertEvent(input: {
    userId: string
    eventType:
      | 'lesson_started'
      | 'block_completed'
      | 'assessment_submitted'
      | 'assessment_passed'
      | 'assessment_failed'
      | 'remediation_assigned'
      | 'review_completed'
    lessonId?: string | null
    moduleId?: string | null
    assessmentId?: string | null
    payload?: Record<string, unknown>
  }): Promise<void>
}
